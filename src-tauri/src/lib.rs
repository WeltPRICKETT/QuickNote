use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    str::FromStr,
    sync::Mutex,
};
use tauri::{
    Emitter,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, State, Url, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NoteMeta {
    id: String,
    title: String,
    path: String,
    created: String,
    updated: String,
    pinned: bool,
    tags: Vec<String>,
    excerpt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NoteDocument {
    meta: NoteMeta,
    body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    theme: String,
    font_size: u16,
    font_family: String,
    mono_font_family: String,
    note_directory: String,
    global_shortcut: String,
    hide_on_blur: bool,
    smooth_caret: bool,
    typewriter_scroll: bool,
}

#[derive(Debug)]
struct QuickNoteState {
    notes_dir: PathBuf,
    settings_path: PathBuf,
    pending_opened_note_ids: Vec<String>,
}

type SharedState = Mutex<QuickNoteState>;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                // Only the wake shortcut is ever registered, so any press toggles the window.
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let state = init_state(app.handle())?;
            let configured = read_settings_file(&state.settings_path)
                .map(|settings| settings.global_shortcut)
                .unwrap_or_else(|| "Alt+Space".into());
            app.manage(Mutex::new(state));
            import_cli_opened_files(app.handle());
            setup_tray(app.handle())?;
            let shortcut = parse_shortcut(&configured)
                .unwrap_or_else(|| Shortcut::new(Some(Modifiers::ALT), Code::Space));
            if let Err(error) = app.global_shortcut().register(shortcut) {
                eprintln!("failed to register global shortcut {configured}: {error}");
            }
            Ok(())
        })
        // Closing the window (X button, Alt+F4) hides to tray; quitting is done
        // from the tray menu, so the global wake shortcut keeps working.
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Focused(false) => {
                    if should_hide_on_blur(window.app_handle()) {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            read_note,
            consume_opened_notes,
            create_note,
            save_note,
            delete_note,
            search_notes,
            get_settings,
            update_settings,
            toggle_window,
            set_window_pinned,
            choose_notes_dir
        ])
        .build(tauri::generate_context!())
        .expect("error while building QuickNote")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let RunEvent::Opened { urls } = event {
                if let Err(error) = handle_opened_urls(app, urls) {
                    eprintln!("failed to open external markdown file: {error}");
                }
            }
        });
}

fn init_state(app: &AppHandle) -> tauri::Result<QuickNoteState> {
    let data_dir = if is_portable(app) {
        app.path().resource_dir()?.join("data")
    } else {
        app.path().app_data_dir()?
    };
    let settings_path = data_dir.join("settings.json");
    let default_notes_dir = if is_portable(app) {
        data_dir.join("notes")
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| data_dir.clone())
            .join("QuickNotes")
    };
    let notes_dir = read_settings_file(&settings_path)
        .and_then(|settings| normalized_notes_dir(&settings.note_directory))
        .unwrap_or(default_notes_dir);

    fs::create_dir_all(&notes_dir)?;
    fs::create_dir_all(&data_dir)?;

    Ok(QuickNoteState {
        notes_dir,
        settings_path,
        pending_opened_note_ids: Vec::new(),
    })
}

fn is_portable(app: &AppHandle) -> bool {
    std::env::var("QUICKNOTE_PORTABLE").ok().as_deref() == Some("1")
        || app
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("data").exists())
            .unwrap_or(false)
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show QuickNote", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut tray = TrayIconBuilder::new();
    // Without an image the tray entry is invisible on Windows.
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.menu(&menu)
        .tooltip("QuickNote")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = toggle_main_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = show_main_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
fn list_notes(state: State<SharedState>) -> Result<Vec<NoteMeta>, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    let mut notes = read_notes(&guard.notes_dir)?;
    notes.sort_by(|a, b| b.meta.updated.cmp(&a.meta.updated));
    Ok(notes.into_iter().map(|note| note.meta).collect())
}

#[tauri::command]
fn read_note(id: String, state: State<SharedState>) -> Result<NoteDocument, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    read_notes(&guard.notes_dir)?
        .into_iter()
        .find(|note| note.meta.id == id)
        .ok_or_else(|| format!("note not found: {id}"))
}

#[tauri::command]
fn consume_opened_notes(state: State<SharedState>) -> Result<Vec<String>, String> {
    let mut guard = state.lock().map_err(|error| error.to_string())?;
    Ok(std::mem::take(&mut guard.pending_opened_note_ids))
}

#[tauri::command]
fn create_note(state: State<SharedState>) -> Result<NoteDocument, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    let now = Utc::now().to_rfc3339();
    let filename = markdown_filename(&now, "quick-note");
    let meta = NoteMeta {
        id: filename.clone(),
        title: "Untitled".into(),
        path: filename.clone(),
        created: now.clone(),
        updated: now,
        pinned: false,
        tags: vec![],
        excerpt: String::new(),
    };
    let note = NoteDocument {
        meta,
        body: String::new(),
    };
    write_note(&guard.notes_dir, &note)?;
    Ok(note)
}

#[tauri::command]
fn save_note(id: String, body: String, state: State<SharedState>) -> Result<NoteMeta, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    let mut note = read_note_from_path(&guard.notes_dir.join(&id))?;
    note.body = body;
    note.meta.title = infer_title(&note.body);
    note.meta.updated = Utc::now().to_rfc3339();
    note.meta.excerpt = note.body.split_whitespace().collect::<Vec<_>>().join(" ");
    note.meta.excerpt.truncate(140);
    write_note(&guard.notes_dir, &note)?;
    Ok(note.meta)
}

#[tauri::command]
fn delete_note(id: String, state: State<SharedState>) -> Result<(), String> {
    if id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err(format!("invalid note id: {id}"));
    }
    let guard = state.lock().map_err(|error| error.to_string())?;
    let path = guard.notes_dir.join(&id);
    if !path.exists() {
        return Err(format!("note not found: {id}"));
    }
    fs::remove_file(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn search_notes(query: String, state: State<SharedState>) -> Result<Vec<serde_json::Value>, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    let terms = query.to_lowercase();
    let mut results = read_notes(&guard.notes_dir)?
        .into_iter()
        .filter_map(|note| {
            let haystack = format!(
                "{} {} {} {}",
                note.meta.title,
                note.meta.excerpt,
                note.meta.tags.join(" "),
                note.body
            )
            .to_lowercase();
            let score = if terms.is_empty() {
                if note.meta.pinned { 1000 } else { 100 }
            } else if note.meta.title.to_lowercase().contains(&terms) {
                80
            } else if haystack.contains(&terms) {
                20
            } else {
                0
            };
            if score == 0 {
                None
            } else {
                let mut value = serde_json::to_value(note.meta).ok()?;
                value["score"] = serde_json::json!(score);
                Some(value)
            }
        })
        .collect::<Vec<_>>();

    results.sort_by(|a, b| b["score"].as_i64().cmp(&a["score"].as_i64()));
    Ok(results)
}

#[tauri::command]
fn get_settings(state: State<SharedState>) -> Result<AppSettings, String> {
    let guard = state.lock().map_err(|error| error.to_string())?;
    Ok(read_settings_file(&guard.settings_path).unwrap_or_else(|| default_settings(&guard.notes_dir)))
}

#[tauri::command]
fn update_settings(
    app: AppHandle,
    settings: AppSettings,
    state: State<SharedState>,
) -> Result<AppSettings, String> {
    let mut guard = state.lock().map_err(|error| error.to_string())?;
    let previous = read_settings_file(&guard.settings_path).unwrap_or_else(|| default_settings(&guard.notes_dir));

    if previous.global_shortcut != settings.global_shortcut {
        apply_global_shortcut(&app, &previous.global_shortcut, &settings.global_shortcut)?;
    }

    let mut next = settings;
    if previous.note_directory != next.note_directory {
        let notes_dir = normalized_notes_dir(&next.note_directory)
            .ok_or_else(|| format!("无效的存储目录: {}", next.note_directory))?;
        fs::create_dir_all(&notes_dir).map_err(|error| error.to_string())?;
        guard.notes_dir = notes_dir.clone();
        next.note_directory = notes_dir.display().to_string();
    }

    let raw = serde_json::to_string_pretty(&next).map_err(|error| error.to_string())?;
    fs::write(&guard.settings_path, raw).map_err(|error| error.to_string())?;
    Ok(next)
}

/// Swap the registered wake shortcut, rolling back to the previous one on failure.
fn apply_global_shortcut(app: &AppHandle, previous: &str, next: &str) -> Result<(), String> {
    let parsed = parse_shortcut(next).ok_or_else(|| format!("无法识别的快捷键: {next}"))?;
    let manager = app.global_shortcut();
    if let Some(old) = parse_shortcut(previous) {
        let _ = manager.unregister(old);
    }
    manager.register(parsed).map_err(|error| {
        if let Some(old) = parse_shortcut(previous) {
            let _ = manager.register(old);
        }
        format!("注册快捷键失败（可能已被其他程序占用）: {error}")
    })
}

fn parse_shortcut(value: &str) -> Option<Shortcut> {
    Shortcut::from_str(value).ok()
}

fn read_settings_file(path: &Path) -> Option<AppSettings> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

#[tauri::command]
fn toggle_window(app: AppHandle) -> Result<(), String> {
    toggle_main_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_pinned(app: AppHandle, pinned: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    window.set_always_on_top(pinned).map_err(|error| error.to_string())
}

#[tauri::command]
fn choose_notes_dir(app: AppHandle, state: State<SharedState>) -> Result<Option<String>, String> {
    let current_dir = {
        let guard = state.lock().map_err(|error| error.to_string())?;
        guard.notes_dir.clone()
    };

    let selected = app
        .dialog()
        .file()
        .set_title("选择 QuickNote 存储目录")
        .set_directory(&current_dir)
        .blocking_pick_folder();

    Ok(selected.and_then(file_path_to_path_buf).map(|path| path.display().to_string()))
}

fn toggle_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = app.get_webview_window("main").expect("main window");
    if window.is_visible()? {
        window.hide()?;
    } else {
        show_main_window(app)?;
    }
    Ok(())
}

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = app.get_webview_window("main").expect("main window");
    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn should_hide_on_blur(app: &AppHandle) -> bool {
    let state = app.state::<SharedState>();
    let Ok(guard) = state.lock() else {
        return false;
    };
    read_settings_file(&guard.settings_path)
        .unwrap_or_else(|| default_settings(&guard.notes_dir))
        .hide_on_blur
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
fn handle_opened_urls(app: &AppHandle, urls: Vec<Url>) -> Result<(), String> {
    let paths = urls
        .into_iter()
        .map(|url| {
            url.to_file_path()
                .map_err(|_| format!("unsupported opened resource: {url}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    import_opened_paths(app, paths).map(|_| ())
}

fn import_cli_opened_files(app: &AppHandle) {
    let paths = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| {
            !path
                .to_string_lossy()
                .starts_with("-psn_")
                && is_markdown_path(path)
        })
        .collect::<Vec<_>>();

    if !paths.is_empty() {
        if let Err(error) = import_opened_paths(app, paths) {
            eprintln!("failed to open cli markdown file: {error}");
        }
    }
}

fn import_opened_paths(app: &AppHandle, paths: Vec<PathBuf>) -> Result<Vec<String>, String> {
    let mut opened_ids = Vec::new();
    {
        let state = app.state::<SharedState>();
        let mut guard = state.lock().map_err(|error| error.to_string())?;
        for path in paths {
            let note = import_markdown_file(&guard.notes_dir, &path)?;
            opened_ids.push(note.meta.id);
        }
        guard.pending_opened_note_ids.extend(opened_ids.clone());
    }

    if !opened_ids.is_empty() {
        let _ = show_main_window(app);
        let _ = app.emit("note:external-opened", &opened_ids);
    }
    Ok(opened_ids)
}

fn import_markdown_file(notes_dir: &Path, source: &Path) -> Result<NoteDocument, String> {
    if !is_markdown_path(source) {
        return Err(format!("unsupported file type: {}", source.display()));
    }

    if let (Ok(source), Ok(notes_dir)) = (source.canonicalize(), notes_dir.canonicalize()) {
        if source.parent() == Some(notes_dir.as_path()) {
            return read_note_from_path(&source);
        }
    }

    let raw = fs::read_to_string(source).map_err(|error| error.to_string())?;
    let filename = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("imported-note.md");
    let target = available_import_path(notes_dir, filename);
    fs::write(&target, raw).map_err(|error| error.to_string())?;
    read_note_from_path(&target)
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

fn available_import_path(notes_dir: &Path, filename: &str) -> PathBuf {
    let candidate = notes_dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("imported-note");
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("md");

    for index in 1.. {
        let candidate = notes_dir.join(format!("{stem}-{index}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("import path loop is unbounded")
}

fn read_notes(dir: &Path) -> Result<Vec<NoteDocument>, String> {
    let entries = fs::read_dir(dir).map_err(|error| error.to_string())?;
    let mut notes = Vec::new();
    for entry in entries {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
            notes.push(read_note_from_path(&path)?);
        }
    }
    Ok(notes)
}

fn read_note_from_path(path: &Path) -> Result<NoteDocument, String> {
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let (meta_block, body) = split_frontmatter(&raw);
    let now = Utc::now().to_rfc3339();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("note.md")
        .to_string();
    let meta = NoteMeta {
        id: file_name.clone(),
        title: infer_title(&body),
        path: file_name,
        created: read_field(&meta_block, "created").unwrap_or_else(|| now.clone()),
        updated: read_field(&meta_block, "updated").unwrap_or(now),
        pinned: read_field(&meta_block, "pinned").as_deref() == Some("true"),
        tags: read_tags(&meta_block),
        excerpt: body.split_whitespace().take(24).collect::<Vec<_>>().join(" "),
    };
    Ok(NoteDocument { meta, body })
}

fn write_note(dir: &Path, note: &NoteDocument) -> Result<(), String> {
    let raw = format!(
        "---\ncreated: {}\nupdated: {}\npinned: {}\ntags: [{}]\n---\n{}",
        note.meta.created,
        note.meta.updated,
        note.meta.pinned,
        note.meta
            .tags
            .iter()
            .map(|tag| format!("\"{tag}\""))
            .collect::<Vec<_>>()
            .join(", "),
        note.body
    );
    fs::write(dir.join(&note.meta.path), raw).map_err(|error| error.to_string())
}

fn split_frontmatter(raw: &str) -> (String, String) {
    if let Some(rest) = raw.strip_prefix("---") {
        if let Some((frontmatter, body)) = rest.split_once("---") {
            return (frontmatter.to_string(), body.trim_start().to_string());
        }
    }
    (String::new(), raw.to_string())
}

fn read_field(frontmatter: &str, key: &str) -> Option<String> {
    frontmatter
        .lines()
        .find_map(|line| line.trim().strip_prefix(&format!("{key}:")).map(|value| value.trim().to_string()))
}

fn read_tags(frontmatter: &str) -> Vec<String> {
    read_field(frontmatter, "tags")
        .map(|tags| {
            tags.trim_matches(['[', ']'])
                .split(',')
                .map(|tag| tag.trim().trim_matches('"').to_string())
                .filter(|tag| !tag.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn infer_title(body: &str) -> String {
    body.lines()
        .find_map(|line| line.trim().strip_prefix("# ").map(str::trim))
        .or_else(|| body.lines().map(str::trim).find(|line| !line.is_empty()))
        .unwrap_or("Untitled")
        .chars()
        .take(60)
        .collect()
}

fn markdown_filename(iso: &str, slug: &str) -> String {
    let compact = iso
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .take(12)
        .collect::<String>();
    format!("{compact}-{}.md", slug.replace(' ', "-").to_lowercase())
}

fn default_settings(notes_dir: &Path) -> AppSettings {
    AppSettings {
        theme: "system".into(),
        font_size: 16,
        font_family: "sans".into(),
        mono_font_family: "jetbrains".into(),
        note_directory: notes_dir.display().to_string(),
        global_shortcut: "Alt+Space".into(),
        hide_on_blur: true,
        smooth_caret: true,
        typewriter_scroll: true,
    }
}

fn normalized_notes_dir(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed == "~" {
        return dirs::home_dir();
    }
    if let Some(rest) = trimmed.strip_prefix("~/") {
        return dirs::home_dir().map(|home| home.join(rest));
    }
    Some(PathBuf::from(trimmed))
}

fn file_path_to_path_buf(value: FilePath) -> Option<PathBuf> {
    match value {
        FilePath::Path(path) => Some(path),
        FilePath::Url(url) => url.to_file_path().ok(),
    }
}
