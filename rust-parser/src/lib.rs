use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use wasm_bindgen::prelude::*;

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

struct ComponentContext {
    class: String,
    attrs: HashMap<String, String>,
    own_offset: Vector3,
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

fn to_number(s: Option<&String>, fallback: f64) -> f64 {
    s.and_then(|v| v.parse::<f64>().ok()).unwrap_or(fallback)
}

fn to_int(s: Option<&String>, fallback: i64) -> i64 {
    s.and_then(|v| v.parse::<i64>().ok()).unwrap_or(fallback)
}

fn normalize_version(v: &str) -> String {
    let trimmed = v.trim();
    if trimmed.contains('.') {
        return trimmed.to_string();
    }
    let num = trimmed.parse::<i64>().unwrap_or(0);
    if num >= 100 {
        format!("{:.1}", num as f64 / 100.0)
    } else {
        format!("{:.1}", num as f64)
    }
}

fn is_at_tags(path: &VecDeque<String>, tags: &[&str]) -> bool {
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

fn build_datavault_flags(
    attrs: &HashMap<String, String>,
) -> (Option<bool>, Option<bool>, Option<bool>) {
    let has_blueprints = attrs
        .get("has_blueprints")
        .map(|v| v == "1")
        .or_else(|| attrs.get("blueprints").map(|v| v == "1"));
    let has_wares = attrs
        .get("has_wares")
        .map(|v| v == "1")
        .or_else(|| attrs.get("wares").map(|v| v == "1"));
    let has_signalleak = attrs
        .get("has_signalleak")
        .map(|v| v == "1")
        .or_else(|| attrs.get("signalleak").map(|v| v == "1"));
    (has_blueprints, has_wares, has_signalleak)
}

#[wasm_bindgen]
pub struct SaveParser {
    meta: Meta,
    sectors: HashMap<String, SectorData>,
    sector_stack: VecDeque<String>,
    component_stack: VecDeque<ComponentContext>,
    path: VecDeque<String>,
    tag_count: usize,

    current_station_owner: Option<String>,
    current_station_modules: Vec<StationModule>,
    current_entry_index: Option<i64>,
    current_entry_ref: Option<String>,
    current_entry_equipments: Vec<StationEquipment>,
}

#[wasm_bindgen]
impl SaveParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            meta: Meta::default(),
            sectors: HashMap::new(),
            sector_stack: VecDeque::new(),
            component_stack: VecDeque::new(),
            path: VecDeque::new(),
            tag_count: 0,
            current_station_owner: None,
            current_station_modules: Vec::new(),
            current_entry_index: None,
            current_entry_ref: None,
            current_entry_equipments: Vec::new(),
        }
    }

    fn get_accumulated_position(&self) -> Vector3 {
        let mut result = Vector3::default();
        for component in &self.component_stack {
            result.x += component.own_offset.x;
            result.y += component.own_offset.y;
            result.z += component.own_offset.z;
        }
        result
    }

    fn current_sector_data_mut(&mut self) -> Option<&mut SectorData> {
        self.sector_stack
            .back()
            .and_then(|key| self.sectors.get_mut(key))
    }

    fn handle_open_tag(&mut self, name: &str, attrs: &HashMap<String, String>) {
        self.tag_count += 1;
        self.path.push_back(name.to_string());

        if name == "component" {
            let class = attrs.get("class").cloned().unwrap_or_default();
            self.component_stack.push_back(ComponentContext {
                class: class.clone(),
                attrs: attrs.clone(),
                own_offset: Vector3::default(),
            });

            if class == "sector" {
                let macro_val = attrs
                    .get("macro")
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();
                self.sector_stack.push_back(macro_val.clone());
                if !self.sectors.contains_key(&macro_val) {
                    let is_known = attrs.get("known").map(|v| v == "1").unwrap_or(false)
                        || attrs.get("knownto").map(|v| v == "player").unwrap_or(false);
                    self.sectors.insert(
                        macro_val.clone(),
                        SectorData {
                            name: macro_val,
                            is_known,
                            stations: Vec::new(),
                            datavaults: Vec::new(),
                            erlking_vaults: Vec::new(),
                            abandoned_ships: Vec::new(),
                        },
                    );
                }
            }

            if class == "station" {
                self.current_station_owner = attrs.get("owner").cloned();
                self.current_station_modules = Vec::new();
            }
        }

        if is_at_tags(&self.path, &["component", "offset", "position"]) {
            if let Some(component) = self.component_stack.back_mut() {
                component.own_offset = Vector3 {
                    x: to_number(attrs.get("x"), 0.0),
                    y: to_number(attrs.get("y"), 0.0),
                    z: to_number(attrs.get("z"), 0.0),
                };
            }
        }

        if is_at_tags(&self.path, &["savegame", "info", "game"]) {
            self.meta.guid = attrs.get("guid").cloned().unwrap_or_default();
            self.meta.seed = to_int(attrs.get("seed"), 0);
            self.meta.time = attrs
                .get("time")
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);
            self.meta.version = attrs.get("version").cloned().unwrap_or_default();
        }

        if is_at_tags(&self.path, &["savegame", "info", "player"]) {
            self.meta.player_name = attrs.get("name").cloned().unwrap_or_default();
        }

        if is_at_tags(
            &self.path,
            &["component", "construction", "sequence", "entry"],
        ) && self.current_station_owner.as_deref() == Some("player")
        {
            self.current_entry_index = Some(to_int(attrs.get("index"), 0));
            self.current_entry_ref = attrs.get("macro").cloned();
            self.current_entry_equipments = Vec::new();
        }

        if is_at_tags(
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
        ) && self.current_entry_index.is_some()
        {
            self.current_entry_equipments.push(StationEquipment {
                equip_type: "shields".to_string(),
                ref_field: attrs.get("macro").cloned().unwrap_or_default(),
                group: attrs.get("group").cloned().unwrap_or_default(),
                exact: to_int(attrs.get("exact"), 1),
            });
        }

        if is_at_tags(
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
        ) && self.current_entry_index.is_some()
        {
            self.current_entry_equipments.push(StationEquipment {
                equip_type: "turrets".to_string(),
                ref_field: attrs.get("macro").cloned().unwrap_or_default(),
                group: attrs.get("group").cloned().unwrap_or_default(),
                exact: to_int(attrs.get("exact"), 1),
            });
        }
    }

    fn handle_close_tag(&mut self, name: &str) {
        if name == "entry" && self.current_entry_index.is_some() && self.current_entry_ref.is_some()
        {
            let module = StationModule {
                index: self.current_entry_index.unwrap(),
                ref_field: self.current_entry_ref.clone().unwrap(),
                equipments: self.current_entry_equipments.clone(),
            };
            self.current_station_modules.push(module);
            self.current_entry_index = None;
            self.current_entry_ref = None;
            self.current_entry_equipments = Vec::new();
        }

        if name == "component" {
            let pos = self.get_accumulated_position();

            let component_data = self
                .component_stack
                .back()
                .map(|c| (c.class.clone(), c.attrs.clone()));

            // Clone modules before potential mutable borrow
            let modules_snapshot = self.current_station_modules.clone();

            if let Some((class, attrs)) = component_data {
                if let Some(sector_data) = self.current_sector_data_mut() {
                    if class == "station" {
                        let owner = attrs.get("owner").cloned().unwrap_or_default();
                        let modules_clone = if owner == "player" && !modules_snapshot.is_empty() {
                            modules_snapshot
                        } else {
                            Vec::new()
                        };
                        let entry = StationEntry {
                            code: attrs.get("code").cloned().unwrap_or_default(),
                            macro_field: attrs.get("macro").cloned().unwrap_or_default(),
                            owner: owner,
                            x: pos.x,
                            y: pos.y,
                            z: pos.z,
                            is_wreck: if attrs.get("state").map(|v| v == "wreck").unwrap_or(false) {
                                Some(true)
                            } else {
                                None
                            },
                            is_headquarter: if attrs
                                .get("factionheadquarters")
                                .map(|v| v == "1")
                                .unwrap_or(false)
                            {
                                Some(true)
                            } else {
                                None
                            },
                            modules: modules_clone,
                        };
                        sector_data.stations.push(entry);
                    } else if class == "datavault" {
                        let (has_bp, has_w, has_sl) = build_datavault_flags(&attrs);
                        let entry = DatavaultEntry {
                            code: attrs.get("code").cloned().unwrap_or_default(),
                            macro_field: attrs.get("macro").cloned().unwrap_or_default(),
                            owner: attrs.get("owner").cloned().unwrap_or_default(),
                            x: pos.x,
                            y: pos.y,
                            z: pos.z,
                            has_blueprints: has_bp,
                            has_wares: has_w,
                            has_signalleak: has_sl,
                        };
                        sector_data.datavaults.push(entry);
                    } else if attrs
                        .get("macro")
                        .map(|m| m.to_lowercase().contains("erlking_vault"))
                        .unwrap_or(false)
                    {
                        let (has_bp, has_w, has_sl) = build_datavault_flags(&attrs);
                        let entry = DatavaultEntry {
                            code: attrs.get("code").cloned().unwrap_or_default(),
                            macro_field: attrs.get("macro").cloned().unwrap_or_default(),
                            owner: attrs.get("owner").cloned().unwrap_or_default(),
                            x: pos.x,
                            y: pos.y,
                            z: pos.z,
                            has_blueprints: has_bp,
                            has_wares: has_w,
                            has_signalleak: has_sl,
                        };
                        sector_data.erlking_vaults.push(entry);
                    } else if class.starts_with("ship_")
                        && attrs
                            .get("owner")
                            .map(|o| o == "ownerless")
                            .unwrap_or(false)
                    {
                        let entry = AbandonedShipEntry {
                            code: attrs.get("code").cloned().unwrap_or_default(),
                            macro_field: attrs.get("macro").cloned().unwrap_or_default(),
                            class: class.clone(),
                            x: pos.x,
                            y: pos.y,
                            z: pos.z,
                        };
                        sector_data.abandoned_ships.push(entry);
                    }
                }

                if class == "station" {
                    self.current_station_owner = None;
                    self.current_station_modules = Vec::new();
                    self.current_entry_index = None;
                    self.current_entry_ref = None;
                    self.current_entry_equipments = Vec::new();
                }

                if class == "sector" {
                    self.sector_stack.pop_back();
                }
            }

            self.component_stack.pop_back();
        }

        if self.path.back().map(|s| s.as_str()) == Some(name) {
            self.path.pop_back();
        }
    }

    #[wasm_bindgen]
    pub fn feed(&mut self, input: &[u8]) {
        let mut reader = quick_xml::Reader::from_reader(input);
        reader.config_mut().trim_text(false);

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(quick_xml::events::Event::Start(e)) => {
                    let name = String::from_utf8_lossy(e.name().0).to_lowercase();
                    let attrs = parse_attrs(&e);
                    self.handle_open_tag(&name, &attrs);
                }
                Ok(quick_xml::events::Event::Empty(e)) => {
                    let name = String::from_utf8_lossy(e.name().0).to_lowercase();
                    let attrs = parse_attrs(&e);
                    self.handle_open_tag(&name, &attrs);
                    self.handle_close_tag(&name);
                }
                Ok(quick_xml::events::Event::End(e)) => {
                    let name = String::from_utf8_lossy(e.name().0).to_lowercase();
                    self.handle_close_tag(&name);
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
    }

    #[wasm_bindgen]
    pub fn finish(&self, filename: &str) -> String {
        let stripped_filename = filename
            .replace(".xml.gz", "")
            .replace(".gz", "")
            .replace(".xml", "");

        let is_compatible = normalize_version(&self.meta.version) == normalize_version("8.0");

        let archive = SaveArchive {
            meta: ArchiveMeta {
                guid: self.meta.guid.clone(),
                seed: self.meta.seed,
                time: self.meta.time,
                player_name: self.meta.player_name.clone(),
                version: self.meta.version.clone(),
                filename: stripped_filename,
                parser_version: "v1".to_string(),
                source: "original".to_string(),
            },
            sectors: self.sectors.clone(),
            isCompatible: is_compatible,
        };

        serde_json::to_string(&archive)
            .unwrap_or_else(|_| "{\"meta\":{},\"sectors\":{},\"isCompatible\":false}".to_string())
    }

    #[wasm_bindgen]
    pub fn tag_count(&self) -> usize {
        self.tag_count
    }

    #[wasm_bindgen]
    pub fn sector_count(&self) -> usize {
        self.sectors.len()
    }
}

#[wasm_bindgen]
pub fn parse_save(input: &[u8], filename: &str) -> String {
    let mut parser = SaveParser::new();
    parser.feed(input);
    parser.finish(filename)
}
