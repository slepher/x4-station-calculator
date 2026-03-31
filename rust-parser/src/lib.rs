use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum ParsePhase {
    Receiving,
    Parsing,
    Finalizing,
    Done,
    Error,
}

#[derive(Clone, Debug)]
struct ParserError {
    message: String,
}

impl ParserError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressInfo {
    phase: ParsePhase,
    input_bytes_total: usize,
    parsed_bytes_total: usize,
    buffered_bytes: usize,
    expected_total_bytes: usize,
    percent: f64,
    tag_count: usize,
    sector_count: usize,
    done: bool,
    input_complete: bool,
    error: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct Vector3 {
    x: f64,
    y: f64,
    z: f64,
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct Meta {
    guid: String,
    seed: i64,
    time: f64,
    #[serde(rename = "playerName")]
    player_name: String,
    version: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct StationModule {
    index: i64,
    #[serde(rename = "ref")]
    ref_field: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    equipments: Vec<StationEquipment>,
}

#[derive(Clone, Serialize, Deserialize)]
struct StationEquipment {
    #[serde(rename = "type")]
    equip_type: String,
    #[serde(rename = "ref")]
    ref_field: String,
    group: String,
    exact: i64,
}

#[derive(Clone, Serialize, Deserialize)]
struct StationEntry {
    code: String,
    #[serde(rename = "macro")]
    macro_field: String,
    owner: String,
    x: f64,
    y: f64,
    z: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_wreck: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_headquarter: Option<bool>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    modules: Vec<StationModule>,
}

#[derive(Clone, Serialize, Deserialize)]
struct DatavaultEntry {
    code: String,
    #[serde(rename = "macro")]
    macro_field: String,
    owner: String,
    x: f64,
    y: f64,
    z: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_blueprints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_wares: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_signalleak: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
struct AbandonedShipEntry {
    code: String,
    #[serde(rename = "macro")]
    macro_field: String,
    class: String,
    x: f64,
    y: f64,
    z: f64,
}

#[derive(Clone, Serialize, Default)]
struct SectorData {
    name: String,
    is_known: bool,
    stations: Vec<StationEntry>,
    datavaults: Vec<DatavaultEntry>,
    #[serde(rename = "erlkingVaults")]
    erlking_vaults: Vec<DatavaultEntry>,
    #[serde(rename = "abandonedShips")]
    abandoned_ships: Vec<AbandonedShipEntry>,
}

#[derive(Clone, Serialize)]
struct SaveArchive {
    meta: ArchiveMeta,
    sectors: HashMap<String, SectorData>,
    isCompatible: bool,
}

#[derive(Clone, Serialize)]
struct ArchiveMeta {
    guid: String,
    seed: i64,
    time: f64,
    #[serde(rename = "playerName")]
    player_name: String,
    version: String,
    filename: String,
    #[serde(rename = "parser_version")]
    parser_version: String,
    source: String,
}

#[derive(Clone, Default)]
struct ComponentCtx {
    class: String,
    code: Option<String>,
    macro_field: Option<String>,
    owner: Option<String>,
    own_offset: Vector3,
    has_blueprints: Option<bool>,
    has_wares: Option<bool>,
    has_signalleak: Option<bool>,
    is_wreck: bool,
    is_headquarter: bool,
}

fn parse_attrs<'a>(e: &'a quick_xml::events::BytesStart<'a>) -> HashMap<String, String> {
    let mut attrs = HashMap::new();
    for attr in e.attributes().flatten() {
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let value = String::from_utf8_lossy(&attr.value).to_string();
        attrs.insert(key, value);
    }
    attrs
}

fn num(s: Option<&String>, fallback: f64) -> f64 {
    s.and_then(|v| v.parse::<f64>().ok()).unwrap_or(fallback)
}

fn to_int(s: Option<&String>, fallback: i64) -> i64 {
    s.and_then(|v| v.parse::<i64>().ok()).unwrap_or(fallback)
}

fn norm_ver(v: &str) -> String {
    let trimmed = v.trim();
    if trimmed.contains('.') {
        return trimmed.to_string();
    }
    let n = trimmed.parse::<i64>().unwrap_or(0);
    if n >= 100 {
        format!("{:.1}", n as f64 / 100.0)
    } else {
        format!("{:.1}", n as f64)
    }
}

fn at_tags(path: &VecDeque<String>, tags: &[&str]) -> bool {
    let n = tags.len();
    if path.len() < n {
        return false;
    }
    for (i, tag) in tags.iter().enumerate() {
        if path.get(path.len() - n + i).map(|s| s.as_str()) != Some(*tag) {
            return false;
        }
    }
    true
}

fn dv_flags(attrs: &HashMap<String, String>) -> (Option<bool>, Option<bool>, Option<bool>) {
    let has_bp = attrs
        .get("has_blueprints")
        .map(|v| v == "1")
        .or_else(|| attrs.get("blueprints").map(|v| v == "1"));
    let has_w = attrs
        .get("has_wares")
        .map(|v| v == "1")
        .or_else(|| attrs.get("wares").map(|v| v == "1"));
    let has_sl = attrs
        .get("has_signalleak")
        .map(|v| v == "1")
        .or_else(|| attrs.get("signalleak").map(|v| v == "1"));
    (has_bp, has_w, has_sl)
}

#[wasm_bindgen]
pub struct SaveParser {
    buffer: Vec<u8>,
    consumed: usize,
    total_parsed: usize,

    expected_total_bytes: usize,

    meta: Meta,
    sectors: HashMap<String, SectorData>,
    sector_stack: VecDeque<String>,
    comp_stack: VecDeque<ComponentCtx>,
    path: VecDeque<String>,
    tags: usize,

    phase: ParsePhase,
    input_complete: bool,
    done: bool,
    error: Option<ParserError>,

    station_owner: Option<String>,
    station_mods: Vec<StationModule>,
    entry_idx: Option<i64>,
    entry_ref: Option<String>,
    entry_eq: Vec<StationEquipment>,
}

#[wasm_bindgen]
impl SaveParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
            consumed: 0,
            total_parsed: 0,

            expected_total_bytes: 0,

            meta: Meta::default(),
            sectors: HashMap::new(),
            sector_stack: VecDeque::new(),
            comp_stack: VecDeque::new(),
            path: VecDeque::new(),
            tags: 0,

            phase: ParsePhase::Receiving,
            input_complete: false,
            done: false,
            error: None,

            station_owner: None,
            station_mods: Vec::new(),
            entry_idx: None,
            entry_ref: None,
            entry_eq: Vec::new(),
        }
    }

    pub fn set_expected_total_bytes(&mut self, total: usize) {
        self.expected_total_bytes = total;
    }

    pub fn push_chunk(&mut self, chunk: &[u8]) {
        if self.done || self.error.is_some() {
            return;
        }
        if !chunk.is_empty() {
            if self.consumed > 0 {
                self.buffer.drain(..self.consumed);
                self.consumed = 0;
            }
            self.buffer.extend_from_slice(chunk);
            if self.phase == ParsePhase::Receiving {
                self.phase = ParsePhase::Parsing;
            }
        }
    }

    pub fn finish_input(&mut self) {
        self.input_complete = true;
    }

    pub fn progress_json(&self) -> String {
        let buffered = self.buffer.len().saturating_sub(self.consumed);
        let raw_pct = if self.expected_total_bytes == 0 {
            0.0
        } else {
            self.total_parsed as f64 / self.expected_total_bytes as f64 * 100.0
        };

        let pct = match self.phase {
            ParsePhase::Receiving => 0.0,
            ParsePhase::Parsing => raw_pct.clamp(0.0, 99.0),
            ParsePhase::Finalizing => 99.0,
            ParsePhase::Done => 100.0,
            ParsePhase::Error => raw_pct.clamp(0.0, 100.0),
        };

        serde_json::to_string(&ProgressInfo {
            phase: self.phase,
            input_bytes_total: self.buffer.len(),
            parsed_bytes_total: self.total_parsed,
            buffered_bytes: buffered,
            expected_total_bytes: self.expected_total_bytes,
            percent: pct,
            tag_count: self.tags,
            sector_count: self.sectors.len(),
            done: self.done,
            input_complete: self.input_complete,
            error: self.error.as_ref().map(|e| e.message.clone()),
        })
        .unwrap_or_default()
    }

    pub fn pump(&mut self, max_events: usize) -> bool {
        if self.done || self.error.is_some() {
            return false;
        }

        let available = self.buffer.len().saturating_sub(self.consumed);
        if available == 0 {
            if self.input_complete {
                self.phase = ParsePhase::Finalizing;
                self.done = true;
                self.phase = ParsePhase::Done;
            }
            return false;
        }

        let start = self.consumed;
        let mut reader = quick_xml::Reader::from_reader(&self.buffer[start..]);
        reader.config_mut().trim_text(false);

        let mut events: Vec<quick_xml::events::Event<'static>> = Vec::new();
        let mut processed = 0usize;
        let mut hit_eof = false;

        while processed < max_events {
            let mut event_buf = Vec::new();
            match reader.read_event_into(&mut event_buf) {
                Ok(quick_xml::events::Event::Start(e)) => {
                    events.push(quick_xml::events::Event::Start(e.into_owned()));
                    processed += 1;
                }
                Ok(quick_xml::events::Event::Empty(e)) => {
                    events.push(quick_xml::events::Event::Empty(e.into_owned()));
                    processed += 1;
                }
                Ok(quick_xml::events::Event::End(e)) => {
                    events.push(quick_xml::events::Event::End(e.into_owned()));
                    processed += 1;
                }
                Ok(quick_xml::events::Event::Eof) => {
                    hit_eof = true;
                    break;
                }
                Ok(_) => {
                    processed += 1;
                }
                Err(err) => {
                    if self.input_complete {
                        self.phase = ParsePhase::Error;
                        self.error = Some(ParserError::new(format!("XML parse error: {err}")));
                        return false;
                    }
                    break;
                }
            }
        }

        let parsed = reader.buffer_position() as usize;
        self.consumed = start + parsed;
        self.total_parsed += parsed;

        for event in events {
            match event {
                quick_xml::events::Event::Start(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    let a = parse_attrs(&e);
                    self.open(&n, &a);
                }
                quick_xml::events::Event::Empty(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    let a = parse_attrs(&e);
                    self.open(&n, &a);
                    self.close(&n);
                }
                quick_xml::events::Event::End(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    self.close(&n);
                }
                _ => {}
            }
        }

        if hit_eof && self.input_complete {
            self.phase = ParsePhase::Finalizing;
            self.done = true;
            self.phase = ParsePhase::Done;
            return false;
        }

        self.buffer.len() > self.consumed || !self.input_complete
    }

    fn world_pos(&self) -> Vector3 {
        self.comp_stack.iter().fold(Vector3::default(), |mut r, c| {
            r.x += c.own_offset.x;
            r.y += c.own_offset.y;
            r.z += c.own_offset.z;
            r
        })
    }

    fn open(&mut self, name: &str, a: &HashMap<String, String>) {
        self.tags += 1;
        self.path.push_back(name.into());

        if name == "component" {
            let cls = a.get("class").cloned().unwrap_or_default();
            let (bp, w, sl) = if cls == "datavault"
                || a.get("macro")
                    .map(|m| m.to_lowercase().contains("erlking_vault"))
                    .unwrap_or(false)
            {
                dv_flags(a)
            } else {
                (None, None, None)
            };
            let ctx = ComponentCtx {
                class: cls.clone(),
                code: a.get("code").cloned(),
                macro_field: a.get("macro").cloned(),
                owner: a.get("owner").cloned(),
                own_offset: Vector3::default(),
                has_blueprints: bp,
                has_wares: w,
                has_signalleak: sl,
                is_wreck: a.get("state").map(|v| v == "wreck").unwrap_or(false),
                is_headquarter: a
                    .get("factionheadquarters")
                    .map(|v| v == "1")
                    .unwrap_or(false),
            };
            self.comp_stack.push_back(ctx);

            if cls == "sector" {
                let m = a.get("macro").map(|s| s.to_lowercase()).unwrap_or_default();
                self.sector_stack.push_back(m.clone());
                self.sectors.entry(m.clone()).or_insert_with(|| SectorData {
                    name: m,
                    is_known: a.get("known") == Some(&"1".to_string())
                        || a.get("knownto") == Some(&"player".to_string()),
                    stations: Vec::new(),
                    datavaults: Vec::new(),
                    erlking_vaults: Vec::new(),
                    abandoned_ships: Vec::new(),
                });
            }

            if cls == "station" {
                self.station_owner = a.get("owner").cloned();
                self.station_mods.clear();
            }
        }

        if at_tags(&self.path, &["component", "offset", "position"]) {
            if let Some(c) = self.comp_stack.back_mut() {
                c.own_offset = Vector3 {
                    x: num(a.get("x"), 0.0),
                    y: num(a.get("y"), 0.0),
                    z: num(a.get("z"), 0.0),
                };
            }
        }

        if at_tags(&self.path, &["savegame", "info", "game"]) {
            self.meta.guid = a.get("guid").cloned().unwrap_or_default();
            self.meta.seed = to_int(a.get("seed"), 0);
            self.meta.time = a
                .get("time")
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);
            self.meta.version = a.get("version").cloned().unwrap_or_default();
        }

        if at_tags(&self.path, &["savegame", "info", "player"]) {
            self.meta.player_name = a.get("name").cloned().unwrap_or_default();
        }

        if at_tags(
            &self.path,
            &["component", "construction", "sequence", "entry"],
        ) && self.station_owner.as_deref() == Some("player")
        {
            self.entry_idx = Some(to_int(a.get("index"), 0));
            self.entry_ref = a.get("macro").cloned();
            self.entry_eq.clear();
        }

        if at_tags(
            &self.path,
            &[
                "component",
                "construction",
                "sequence",
                "entry",
                "upgrades",
                "groups",
                "shields",
            ],
        ) && self.entry_idx.is_some()
        {
            self.entry_eq.push(StationEquipment {
                equip_type: "shields".into(),
                ref_field: a.get("macro").cloned().unwrap_or_default(),
                group: a.get("group").cloned().unwrap_or_default(),
                exact: to_int(a.get("exact"), 1),
            });
        }

        if at_tags(
            &self.path,
            &[
                "component",
                "construction",
                "sequence",
                "entry",
                "upgrades",
                "groups",
                "turrets",
            ],
        ) && self.entry_idx.is_some()
        {
            self.entry_eq.push(StationEquipment {
                equip_type: "turrets".into(),
                ref_field: a.get("macro").cloned().unwrap_or_default(),
                group: a.get("group").cloned().unwrap_or_default(),
                exact: to_int(a.get("exact"), 1),
            });
        }
    }

    fn close(&mut self, name: &str) {
        if name == "entry" && self.entry_idx.is_some() && self.entry_ref.is_some() {
            self.station_mods.push(StationModule {
                index: self.entry_idx.unwrap(),
                ref_field: self.entry_ref.clone().unwrap(),
                equipments: std::mem::take(&mut self.entry_eq),
            });
            self.entry_idx = None;
            self.entry_ref = None;
        }

        if name == "component" {
            let pos = self.world_pos();
            let ctx = match self.comp_stack.back().cloned() {
                Some(c) => c,
                None => return,
            };

            if let Some(sk) = self.sector_stack.back().cloned() {
                if let Some(sd) = self.sectors.get_mut(&sk) {
                    match ctx.class.as_str() {
                        "station" => {
                            let mods = if ctx.owner.as_deref() == Some("player") {
                                std::mem::take(&mut self.station_mods)
                            } else {
                                Vec::new()
                            };
                            sd.stations.push(StationEntry {
                                code: ctx.code.clone().unwrap_or_default(),
                                macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                owner: ctx.owner.clone().unwrap_or_default(),
                                x: pos.x,
                                y: pos.y,
                                z: pos.z,
                                is_wreck: if ctx.is_wreck { Some(true) } else { None },
                                is_headquarter: if ctx.is_headquarter { Some(true) } else { None },
                                modules: mods,
                            });
                            self.station_owner = None;
                            self.entry_idx = None;
                            self.entry_ref = None;
                        }
                        "datavault" => {
                            sd.datavaults.push(DatavaultEntry {
                                code: ctx.code.clone().unwrap_or_default(),
                                macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                owner: ctx.owner.clone().unwrap_or_default(),
                                x: pos.x,
                                y: pos.y,
                                z: pos.z,
                                has_blueprints: ctx.has_blueprints,
                                has_wares: ctx.has_wares,
                                has_signalleak: ctx.has_signalleak,
                            });
                        }
                        "sector" => {
                            self.sector_stack.pop_back();
                        }
                        _ => {
                            if ctx
                                .macro_field
                                .as_ref()
                                .map(|m| m.to_lowercase().contains("erlking_vault"))
                                .unwrap_or(false)
                            {
                                sd.erlking_vaults.push(DatavaultEntry {
                                    code: ctx.code.clone().unwrap_or_default(),
                                    macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                    owner: ctx.owner.clone().unwrap_or_default(),
                                    x: pos.x,
                                    y: pos.y,
                                    z: pos.z,
                                    has_blueprints: ctx.has_blueprints,
                                    has_wares: ctx.has_wares,
                                    has_signalleak: ctx.has_signalleak,
                                });
                            } else if ctx.class.starts_with("ship_")
                                && ctx.owner.as_deref() == Some("ownerless")
                            {
                                sd.abandoned_ships.push(AbandonedShipEntry {
                                    code: ctx.code.clone().unwrap_or_default(),
                                    macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                    class: ctx.class.clone(),
                                    x: pos.x,
                                    y: pos.y,
                                    z: pos.z,
                                });
                            }
                        }
                    }
                }
            }

            self.comp_stack.pop_back();
        }

        if self.path.back().map(|s| s.as_str()) == Some(name) {
            self.path.pop_back();
        }
    }

    pub fn finish(&mut self, filename: &str) -> Result<String, JsValue> {
        if let Some(err) = &self.error {
            return Err(JsValue::from_str(&err.message));
        }

        if !self.done {
            return Err(JsValue::from_str(
                "parser is not done yet; keep calling pump()",
            ));
        }

        let f = filename
            .replace(".xml.gz", "")
            .replace(".gz", "")
            .replace(".xml", "");

        let json = serde_json::to_string(&SaveArchive {
            meta: ArchiveMeta {
                guid: self.meta.guid.clone(),
                seed: self.meta.seed,
                time: self.meta.time,
                player_name: self.meta.player_name.clone(),
                version: self.meta.version.clone(),
                filename: f,
                parser_version: "v1".into(),
                source: "original".into(),
            },
            sectors: self.sectors.clone(),
            isCompatible: norm_ver(&self.meta.version) == norm_ver("8.0"),
        })
        .map_err(|e| JsValue::from_str(&format!("serialize error: {e}")))?;

        Ok(json)
    }
}
