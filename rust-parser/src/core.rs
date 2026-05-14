use crate::model::{
    norm_ver, AbandonedShipEntry, AggregatedEquipment, AggregatedStationModule, ArchiveMeta,
    BuildProgress, BuildStorageEntry, DatavaultEntry, DatavaultWareEntry, FactionStationEntry,
    Meta, NpcStationEntry, ParserError, PlayerStationConstruction, PlayerStationEntry, SaveArchive,
    SectorData, StationBaseEntry, StationEquipment, Vector3, WareAmount, WorkforceEntry,
};
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Default)]
struct ComponentCtx {
    class: String,
    id: Option<String>,
    code: Option<String>,
    macro_field: Option<String>,
    owner: Option<String>,
    own_offset: Vector3,
    has_blueprints: Option<bool>,
    has_wares: Option<bool>,
    has_signalleak: Option<bool>,
    is_wreck: bool,
    is_headquarter: bool,
    unlocked: bool,
    ware_totals: HashMap<String, i64>,
    cargo_totals: HashMap<String, i64>,
    reservation_totals: HashMap<String, i64>,
    build_target_station_component_id: Option<String>,
    build_constructions: Vec<PlayerStationConstruction>,
    build_progress: Option<BuildProgress>,
    workforces: Vec<WorkforceEntry>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum EntryMode {
    PlayerStation,
    NpcStation,
    BuildStorage,
}

fn num(s: Option<&String>, fallback: f64) -> f64 {
    s.and_then(|v| v.parse::<f64>().ok()).unwrap_or(fallback)
}

fn to_int(s: Option<&String>, fallback: i64) -> i64 {
    s.and_then(|v| v.parse::<i64>().ok()).unwrap_or(fallback)
}

fn normalize_component_id(value: Option<&String>) -> Option<String> {
    value.map(|raw| {
        raw.strip_prefix('[')
            .and_then(|trimmed| trimmed.strip_suffix(']'))
            .unwrap_or(raw.as_str())
            .to_string()
    })
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

pub(crate) struct SaveParserCore {
    expected_version: Option<String>,
    version_checked: bool,

    pub(crate) meta: Meta,
    sectors: HashMap<String, SectorData>,
    sector_stack: VecDeque<String>,
    comp_stack: VecDeque<ComponentCtx>,
    path: VecDeque<String>,
    tags: usize,

    station_owner: Option<String>,
    current_zone_macro: Option<String>,
    player_station_constructions: Vec<PlayerStationConstruction>,
    npc_station_module_counts: HashMap<String, i64>,
    npc_station_equipment_totals: HashMap<(String, String), i64>,
    entry_mode: Option<EntryMode>,
    entry_id: Option<String>,
    entry_idx: Option<i64>,
    entry_ref: Option<String>,
    entry_predecessor: Option<i64>,
    entry_eq: Vec<StationEquipment>,
}

impl SaveParserCore {
    pub(crate) fn new(expected_version: Option<String>) -> Self {
        Self {
            expected_version,
            version_checked: false,
            meta: Meta::default(),
            sectors: HashMap::new(),
            sector_stack: VecDeque::new(),
            comp_stack: VecDeque::new(),
            path: VecDeque::new(),
            tags: 0,
            station_owner: None,
            current_zone_macro: None,
            player_station_constructions: Vec::new(),
            npc_station_module_counts: HashMap::new(),
            npc_station_equipment_totals: HashMap::new(),
            entry_mode: None,
            entry_id: None,
            entry_idx: None,
            entry_ref: None,
            entry_predecessor: None,
            entry_eq: Vec::new(),
        }
    }

    pub(crate) fn tag_count(&self) -> usize {
        self.tags
    }

    pub(crate) fn set_expected_version(&mut self, expected_version: Option<String>) {
        self.expected_version = expected_version;
    }

    pub(crate) fn sector_count(&self) -> usize {
        self.sectors.len()
    }

    pub(crate) fn open(
        &mut self,
        name: &str,
        a: &HashMap<String, String>,
    ) -> Result<(), ParserError> {
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
            self.comp_stack.push_back(ComponentCtx {
                class: cls.clone(),
                id: normalize_component_id(a.get("id")),
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
                unlocked: false,
                ware_totals: HashMap::new(),
                cargo_totals: HashMap::new(),
                reservation_totals: HashMap::new(),
                build_target_station_component_id: None,
                build_constructions: Vec::new(),
                build_progress: None,
                workforces: Vec::new(),
            });

            if cls == "sector" {
                let m = a.get("macro").map(|s| s.to_lowercase()).unwrap_or_default();
                self.sector_stack.push_back(m.clone());
                self.sectors.entry(m.clone()).or_insert_with(|| SectorData {
                    name: m,
                    is_known: a.get("known") == Some(&"1".to_string())
                        || a.get("knownto") == Some(&"player".to_string()),
                    owner: a.get("owner").cloned(),
                    player_stations: HashMap::new(),
                    xenon_stations: HashMap::new(),
                    khaak_stations: HashMap::new(),
                    npc_stations: HashMap::new(),
                    player_buildstorages: HashMap::new(),
                    datavaults: HashMap::new(),
                    erlking_vaults: HashMap::new(),
                    abandoned_ships: HashMap::new(),
                });
            }

            if cls == "station" {
                self.station_owner = a.get("owner").cloned();
                self.player_station_constructions.clear();
                self.npc_station_module_counts.clear();
                self.npc_station_equipment_totals.clear();
            }

            if cls == "zone" {
                self.current_zone_macro = a.get("macro").cloned();
            }
        }

        if at_tags(&self.path, &["component", "workforces", "workforce"]) {
            if let Some(component) = self.comp_stack.back() {
                if component.class == "station" && component.owner.as_deref() == Some("player") {
                    if let Some(race) = a.get("race").cloned() {
                        let amount = to_int(a.get("amount"), 0);
                        if let Some(station) = self.comp_stack.back_mut() {
                            station.workforces.push(WorkforceEntry { race, amount });
                        }
                    }
                }
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

            if !self.version_checked && !self.meta.version.is_empty() {
                self.version_checked = true;
                if let Some(expected) = &self.expected_version {
                    let save_ver = norm_ver(&self.meta.version);
                    let expected_ver = norm_ver(expected);
                    if save_ver != expected_ver {
                        return Err(ParserError::version_mismatch(
                            self.meta.version.clone(),
                            save_ver,
                            expected.clone(),
                            expected_ver,
                        ));
                    }
                }
            }
        }

        if at_tags(&self.path, &["savegame", "info", "player"]) {
            self.meta.player_name = a.get("name").cloned().unwrap_or_default();
        }

        if at_tags(
            &self.path,
            &["component", "construction", "sequence", "entry"],
        ) {
            if self.station_owner.as_deref() == Some("player") {
                self.entry_mode = Some(EntryMode::PlayerStation);
                self.entry_id = normalize_component_id(a.get("id"));
                self.entry_idx = Some(to_int(a.get("index"), 0));
                self.entry_ref = a.get("macro").cloned();
                self.entry_predecessor = None;
                self.entry_eq.clear();
            } else if self.station_owner.is_some() {
                self.entry_mode = Some(EntryMode::NpcStation);
                self.entry_id = normalize_component_id(a.get("id"));
                if let Some(macro_ref) = a.get("macro").cloned() {
                    *self.npc_station_module_counts.entry(macro_ref).or_insert(0) += 1;
                }
                self.entry_idx = Some(to_int(a.get("index"), 0));
                self.entry_eq.clear();
            }
        }

        if at_tags(
            &self.path,
            &["component", "buildtasks", "inprogress", "build"],
        ) {
            if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                buildstorage.build_target_station_component_id =
                    normalize_component_id(a.get("component"));
            }
        }

        if at_tags(
            &self.path,
            &[
                "component",
                "buildtasks",
                "inprogress",
                "build",
                "sequence",
                "entry",
            ],
        ) {
            if self.current_buildstorage_ctx_mut().is_some() {
                self.entry_mode = Some(EntryMode::BuildStorage);
                self.entry_id = normalize_component_id(a.get("id"));
                self.entry_idx = Some(to_int(a.get("index"), 0));
                self.entry_ref = a.get("macro").cloned();
                self.entry_predecessor = None;
                self.entry_eq.clear();
            }
        }

        if at_tags(
            &self.path,
            &[
                "component",
                "construction",
                "sequence",
                "entry",
                "predecessor",
            ],
        ) {
            self.entry_predecessor = Some(to_int(a.get("index"), 0));
        }

        if name == "unlock" {
            let state = a.get("state").map(|s| s.as_str()).unwrap_or_default();
            if let Some(vault) = self.current_vault_ctx_mut() {
                vault.unlocked = state == "unlocked";
            }
        }

        if name == "ware" {
            if let Some(vault) = self.current_collectable_vault_ctx_mut() {
                if let Some(ware) = a.get("ware").cloned() {
                    let amount = to_int(a.get("amount"), 1);
                    *vault.ware_totals.entry(ware).or_insert(0) += amount;
                }
            }

            let parent_is_cargo = self
                .path
                .get(self.path.len().saturating_sub(2))
                .map(|tag| tag.as_str())
                == Some("cargo");
            if parent_is_cargo {
                if let Some(component) = self.comp_stack.back() {
                    if component.class == "buildstorage" {
                        if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                            if let Some(ware) = a.get("ware").cloned() {
                                let amount = to_int(a.get("amount"), 1);
                                *buildstorage.cargo_totals.entry(ware).or_insert(0) += amount;
                            }
                        }
                    } else if component.class == "storage" {
                        if let Some(ware) = a.get("ware").cloned() {
                            let amount = to_int(a.get("amount"), 1);
                            if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                                *buildstorage.cargo_totals.entry(ware).or_insert(0) += amount;
                            } else if let Some(station) = self.current_station_ctx_mut() {
                                *station.cargo_totals.entry(ware).or_insert(0) += amount;
                            }
                        }
                    }
                }
            }
        }

        if name == "reservation"
            && at_tags(
                &self.path,
                &["component", "trade", "reservations", "reservation"],
            )
        {
            if let Some(ware) = a.get("ware").cloned() {
                let amount = to_int(a.get("amount"), 1);
                if let Some(component) = self.comp_stack.back() {
                    if component.class == "buildstorage" {
                        if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                            *buildstorage.reservation_totals.entry(ware).or_insert(0) += amount;
                        }
                    } else if component.class == "storage" {
                        if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                            *buildstorage.reservation_totals.entry(ware).or_insert(0) += amount;
                        } else if let Some(station) = self.current_station_ctx_mut() {
                            *station.reservation_totals.entry(ware).or_insert(0) += amount;
                        }
                    } else if component.class == "station" {
                        if let Some(station) = self.current_station_ctx_mut() {
                            *station.reservation_totals.entry(ware).or_insert(0) += amount;
                        }
                    }
                }
            }
        }

        if name == "build" {
            if let Some(component) = self.comp_stack.back() {
                if component.class == "buildprocessor" {
                    if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                        buildstorage.build_progress = Some(BuildProgress {
                            start: a.get("start").and_then(|v| v.parse::<f64>().ok()),
                            end: a.get("end").and_then(|v| v.parse::<f64>().ok()),
                            sequenceindex: a
                                .get("sequenceindex")
                                .and_then(|v| v.parse::<i64>().ok()),
                        });
                    }
                }
            }
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
            if self.station_owner.as_deref() == Some("player") {
                self.entry_eq.push(StationEquipment {
                    equip_type: "shields".into(),
                    ref_field: a.get("macro").cloned().unwrap_or_default(),
                    group: a.get("group").cloned().unwrap_or_default(),
                    exact: to_int(a.get("exact"), 1),
                });
            } else if self.station_owner.is_some() {
                let equip_type = "shields".to_string();
                let ref_field = a.get("macro").cloned().unwrap_or_default();
                let amount = to_int(a.get("exact"), 1);
                *self
                    .npc_station_equipment_totals
                    .entry((equip_type, ref_field))
                    .or_insert(0) += amount;
            }
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
            if self.station_owner.as_deref() == Some("player") {
                self.entry_eq.push(StationEquipment {
                    equip_type: "turrets".into(),
                    ref_field: a.get("macro").cloned().unwrap_or_default(),
                    group: a.get("group").cloned().unwrap_or_default(),
                    exact: to_int(a.get("exact"), 1),
                });
            } else if self.station_owner.is_some() {
                let equip_type = "turrets".to_string();
                let ref_field = a.get("macro").cloned().unwrap_or_default();
                let amount = to_int(a.get("exact"), 1);
                *self
                    .npc_station_equipment_totals
                    .entry((equip_type, ref_field))
                    .or_insert(0) += amount;
            }
        }

        if at_tags(
            &self.path,
            &[
                "component",
                "buildtasks",
                "inprogress",
                "build",
                "sequence",
                "entry",
                "upgrades",
                "groups",
                "shields",
            ],
        ) && self.entry_mode == Some(EntryMode::BuildStorage)
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
                "buildtasks",
                "inprogress",
                "build",
                "sequence",
                "entry",
                "upgrades",
                "groups",
                "turrets",
            ],
        ) && self.entry_mode == Some(EntryMode::BuildStorage)
        {
            self.entry_eq.push(StationEquipment {
                equip_type: "turrets".into(),
                ref_field: a.get("macro").cloned().unwrap_or_default(),
                group: a.get("group").cloned().unwrap_or_default(),
                exact: to_int(a.get("exact"), 1),
            });
        }

        Ok(())
    }

    pub(crate) fn close(&mut self, name: &str) -> Result<(), ParserError> {
        let expected = match self.path.back() {
            Some(v) => v.as_str(),
            None => {
                return Err(ParserError::parse_error(format!(
                    "XML close tag </{}> encountered with empty path stack",
                    name
                )));
            }
        };

        if expected != name {
            return Err(ParserError::parse_error(format!(
                "XML close mismatch: expected </{}> but got </{}>",
                expected, name
            )));
        }

        if name == "entry" && self.entry_idx.is_some() && self.entry_ref.is_some() {
            let construction = PlayerStationConstruction {
                id: self.entry_id.clone(),
                index: self.entry_idx.unwrap(),
                ref_field: self.entry_ref.clone().unwrap(),
                predecessor: self.entry_predecessor,
                equipments: if self.entry_mode == Some(EntryMode::PlayerStation) {
                    std::mem::take(&mut self.entry_eq)
                } else {
                    Vec::new()
                },
            };

            match self.entry_mode {
                Some(EntryMode::PlayerStation) => {
                    self.player_station_constructions.push(construction);
                }
                Some(EntryMode::BuildStorage) => {
                    let mut construction = construction;
                    construction.equipments = std::mem::take(&mut self.entry_eq);
                    if let Some(buildstorage) = self.current_buildstorage_ctx_mut() {
                        buildstorage.build_constructions.push(construction);
                    }
                }
                _ => {}
            }

            self.entry_mode = None;
            self.entry_id = None;
            self.entry_idx = None;
            self.entry_ref = None;
            self.entry_predecessor = None;
        }

        if name == "component" {
            let pos = self.world_pos();
            let ctx = self.comp_stack.back().cloned().ok_or_else(|| {
                ParserError::parse_error("XML/component stack underflow while closing </component>")
            })?;

            if let Some(sk) = self.sector_stack.back().cloned() {
                if let Some(sd) = self.sectors.get_mut(&sk) {
                    match ctx.class.as_str() {
                        "station" => {
                            let zone_id = self.current_zone_macro.clone();
                            let base = StationBaseEntry {
                                code: ctx.code.clone().unwrap_or_default(),
                                macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                owner: ctx.owner.clone().unwrap_or_default(),
                                relative_position: Vector3 {
                                    x: pos.x,
                                    y: pos.y,
                                    z: pos.z,
                                },
                                zone_id,
                                is_wreck: if ctx.is_wreck { Some(true) } else { None },
                                is_headquarter: if ctx.is_headquarter { Some(true) } else { None },
                            };

                            match ctx.owner.as_deref() {
                                Some("player") => {
                                    let constructions =
                                        std::mem::take(&mut self.player_station_constructions);
                                    let workforces = ctx.workforces.clone();
                                    let entry = PlayerStationEntry {
                                        base,
                                        component_id: ctx.id.clone(),
                                        constructions,
                                        cargo: ware_amounts(&ctx.cargo_totals),
                                        reservation: ware_amounts(&ctx.reservation_totals),
                                        buildstorage_code: None,
                                        workforces,
                                    };
                                    sd.player_stations.insert(entry.base.code.clone(), entry);
                                }
                                Some("xenon") => {
                                    let modules =
                                        aggregated_modules(&mut self.npc_station_module_counts);
                                    let equipments = aggregated_equipments(
                                        &mut self.npc_station_equipment_totals,
                                    );
                                    let entry = FactionStationEntry {
                                        base,
                                        modules,
                                        equipments,
                                    };
                                    sd.xenon_stations.insert(entry.base.code.clone(), entry);
                                }
                                Some("khaak") => {
                                    let modules =
                                        aggregated_modules(&mut self.npc_station_module_counts);
                                    let equipments = aggregated_equipments(
                                        &mut self.npc_station_equipment_totals,
                                    );
                                    let entry = FactionStationEntry {
                                        base,
                                        modules,
                                        equipments,
                                    };
                                    sd.khaak_stations.insert(entry.base.code.clone(), entry);
                                }
                                _ => {
                                    let modules =
                                        aggregated_modules(&mut self.npc_station_module_counts);
                                    let equipments = aggregated_equipments(
                                        &mut self.npc_station_equipment_totals,
                                    );
                                    let entry = NpcStationEntry {
                                        base,
                                        modules,
                                        equipments,
                                    };
                                    sd.npc_stations.insert(entry.base.code.clone(), entry);
                                }
                            }
                            self.station_owner = None;
                            self.entry_mode = None;
                            self.entry_id = None;
                            self.entry_idx = None;
                            self.entry_ref = None;
                        }
                        "datavault" => {
                            let zone_id = self.current_zone_macro.clone();
                            let entry = DatavaultEntry {
                                code: ctx.code.clone().unwrap_or_default(),
                                macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                owner: ctx.owner.clone().unwrap_or_default(),
                                relative_position: Vector3 {
                                    x: pos.x,
                                    y: pos.y,
                                    z: pos.z,
                                },
                                zone_id,
                                unlocked: ctx.unlocked,
                                wares: ware_entries(&ctx.ware_totals),
                                has_blueprints: ctx.has_blueprints,
                                has_wares: ctx.has_wares,
                                has_signalleak: ctx.has_signalleak,
                            };
                            sd.datavaults.insert(entry.code.clone(), entry);
                        }
                        "sector" => {
                            self.sector_stack.pop_back();
                        }
                        "zone" => {
                            self.current_zone_macro = None;
                        }
                        "buildstorage" => {
                            if ctx.owner.as_deref() == Some("player") {
                                let zone_id = self.current_zone_macro.clone();
                                let entry = BuildStorageEntry {
                                    component_id: ctx.id.clone().unwrap_or_default(),
                                    code: ctx.code.clone().unwrap_or_default(),
                                    owner: ctx.owner.clone().unwrap_or_default(),
                                    relative_position: Vector3 {
                                        x: pos.x,
                                        y: pos.y,
                                        z: pos.z,
                                    },
                                    zone_id,
                                    cargo: ware_amounts(&ctx.cargo_totals),
                                    reservation: ware_amounts(&ctx.reservation_totals),
                                    station_code: None,
                                    target_station_component_id: ctx
                                        .build_target_station_component_id
                                        .clone(),
                                    constructions: ctx.build_constructions.clone(),
                                    progress: ctx.build_progress.clone(),
                                };
                                sd.player_buildstorages.insert(entry.code.clone(), entry);
                            }
                        }
                        _ => {
                            if ctx
                                .macro_field
                                .as_ref()
                                .map(|m| m.to_lowercase().contains("erlking_vault"))
                                .unwrap_or(false)
                            {
                                let zone_id = self.current_zone_macro.clone();
                                let entry = DatavaultEntry {
                                    code: ctx.code.clone().unwrap_or_default(),
                                    macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                    owner: ctx.owner.clone().unwrap_or_default(),
                                    relative_position: Vector3 {
                                        x: pos.x,
                                        y: pos.y,
                                        z: pos.z,
                                    },
                                    zone_id,
                                    unlocked: ctx.unlocked,
                                    wares: ware_entries(&ctx.ware_totals),
                                    has_blueprints: ctx.has_blueprints,
                                    has_wares: ctx.has_wares,
                                    has_signalleak: ctx.has_signalleak,
                                };
                                sd.erlking_vaults.insert(entry.code.clone(), entry);
                            } else if ctx.class.starts_with("ship_")
                                && ctx.owner.as_deref() == Some("ownerless")
                            {
                                let zone_id = self.current_zone_macro.clone();
                                let entry = AbandonedShipEntry {
                                    code: ctx.code.clone().unwrap_or_default(),
                                    macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                    class: ctx.class.clone(),
                                    relative_position: Vector3 {
                                        x: pos.x,
                                        y: pos.y,
                                        z: pos.z,
                                    },
                                    zone_id,
                                };
                                sd.abandoned_ships.insert(entry.code.clone(), entry);
                            }
                        }
                    }
                }
            }

            self.comp_stack.pop_back();
        }

        self.path.pop_back();
        Ok(())
    }

    pub(crate) fn has_open_path(&self) -> bool {
        !self.path.is_empty()
    }

    pub(crate) fn open_path(&self) -> &VecDeque<String> {
        &self.path
    }

    pub(crate) fn finish_archive(&self, filename: &str) -> Result<SaveArchive, ParserError> {
        let f = filename
            .replace(".xml.gz", "")
            .replace(".gz", "")
            .replace(".xml", "");

        let is_compatible = if let Some(expected) = &self.expected_version {
            norm_ver(&self.meta.version) == norm_ver(expected)
        } else {
            true
        };

        Ok(SaveArchive {
            meta: ArchiveMeta {
                guid: self.meta.guid.clone(),
                seed: self.meta.seed,
                time: self.meta.time,
                player_name: self.meta.player_name.clone(),
                version: self.meta.version.clone(),
                filename: f,
                parser_version: "v6".into(),
                post_processor_version: None,
                source: "original".into(),
            },
            sectors: self.sectors.clone(),
            is_compatible,
            is_valid: true,
        })
    }

    fn world_pos(&self) -> Vector3 {
        self.comp_stack.iter().fold(Vector3::default(), |mut r, c| {
            r.x += c.own_offset.x;
            r.y += c.own_offset.y;
            r.z += c.own_offset.z;
            r
        })
    }

    fn current_vault_ctx_mut(&mut self) -> Option<&mut ComponentCtx> {
        self.comp_stack.iter_mut().rev().find(|ctx| {
            ctx.class == "datavault"
                || ctx
                    .macro_field
                    .as_ref()
                    .map(|m| m.to_lowercase().contains("erlking_vault"))
                    .unwrap_or(false)
        })
    }

    fn current_collectable_vault_ctx_mut(&mut self) -> Option<&mut ComponentCtx> {
        let has_collectable = self
            .comp_stack
            .iter()
            .rev()
            .any(|ctx| ctx.class == "collectablewares");
        if !has_collectable {
            return None;
        }
        self.current_vault_ctx_mut()
    }

    fn current_station_ctx_mut(&mut self) -> Option<&mut ComponentCtx> {
        self.comp_stack
            .iter_mut()
            .rev()
            .find(|ctx| ctx.class == "station")
    }

    fn current_buildstorage_ctx_mut(&mut self) -> Option<&mut ComponentCtx> {
        self.comp_stack
            .iter_mut()
            .rev()
            .find(|ctx| ctx.class == "buildstorage")
    }
}

fn ware_entries(input: &HashMap<String, i64>) -> Vec<DatavaultWareEntry> {
    let mut wares = input
        .iter()
        .map(|(ware, amount)| DatavaultWareEntry {
            ware: ware.clone(),
            amount: *amount,
        })
        .collect::<Vec<_>>();
    wares.sort_by(|a, b| a.ware.cmp(&b.ware));
    wares
}

fn aggregated_modules(input: &mut HashMap<String, i64>) -> Vec<AggregatedStationModule> {
    input
        .drain()
        .map(|(ref_field, amount)| AggregatedStationModule { ref_field, amount })
        .collect()
}

fn aggregated_equipments(input: &mut HashMap<(String, String), i64>) -> Vec<AggregatedEquipment> {
    input
        .drain()
        .map(|((equip_type, ref_field), amount)| AggregatedEquipment {
            equip_type,
            ref_field,
            amount,
        })
        .collect()
}

fn ware_amounts(input: &HashMap<String, i64>) -> Vec<WareAmount> {
    let mut wares = input
        .iter()
        .map(|(ware, amount)| WareAmount {
            ware: ware.clone(),
            amount: *amount,
        })
        .collect::<Vec<_>>();
    wares.sort_by(|a, b| a.ware.cmp(&b.ware));
    wares
}
