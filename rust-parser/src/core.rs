use crate::blueprints::BlueprintsParser;
use crate::faction::FactionParser;
use crate::model::{
    norm_ver, AbandonedShipEntry, AggregatedEquipment, AggregatedStationModule, ArchiveMeta,
    BuildProgress, BuildStorageEntry, DatavaultEntry, DatavaultWareEntry, FactionStationEntry,
    Meta, NpcBuildStorageEntry, NpcStationEntry, NpcTradeOffer, ParserError, PlayerShipAssignment,
    PlayerShipAssignmentState, PlayerShipCargo, PlayerShipCommanderKind, PlayerShipEntry,
    PlayerShipOrderSummary, PlayerShipOrderTarget, PlayerStationConstruction, PlayerStationEntry,
    SaveArchive, SectorData, StationBaseEntry, StationEquipment, StationTradeOverrides, Vector3,
    WareAmount, WorkforceEntry,
};
use crate::research::ResearchParser;
use crate::terraforming::TerraformingParser;
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Clone, Default)]
struct ComponentCtx {
    class: String,
    id: Option<String>,
    spawntime: Option<u64>,
    listener_ids: Vec<String>,
    code: Option<String>,
    name: Option<String>,
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
    override_max_totals: HashMap<String, i64>,
    override_buy_totals: HashMap<String, i64>,
    override_sell_totals: HashMap<String, i64>,
    build_target_station_component_id: Option<String>,
    build_constructions: Vec<PlayerStationConstruction>,
    build_progress: Option<BuildProgress>,
    workforces: Vec<WorkforceEntry>,
    trade_offers: Vec<NpcTradeOffer>,
    subordinate_group: Option<String>,
    subordinate_roles: HashMap<String, String>,
    commander_ref: Option<String>,
    default_order: Option<PlayerShipOrderSummary>,
    orders: Vec<PlayerShipOrderSummary>,
    current_order: Option<(bool, PlayerShipOrderSummary)>,
    is_repeat: bool,
}

#[derive(Clone, Default)]
struct ConnectionCtx {
    kind: String,
}

#[derive(Clone)]
struct PendingPlayerShip {
    sector_id: String,
    entry: PlayerShipEntry,
    commander_ref: Option<String>,
    subordinate_group: Option<String>,
}

#[derive(Clone)]
struct PendingNpcStation {
    sector_id: String,
    station_code: String,
    spawntime: u64,
    listener_ids: Vec<String>,
}

#[derive(Clone)]
struct PendingNpcBuildStorage {
    spawntime: u64,
    entry: NpcBuildStorageEntry,
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
    connection_stack: VecDeque<ConnectionCtx>,
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
    research: ResearchParser,
    terraforming: TerraformingParser,
    pub(crate) blueprints: BlueprintsParser,
    faction: FactionParser,
    universe_closed: bool,
    component_kinds: HashMap<String, PlayerShipCommanderKind>,
    connection_commanders: HashMap<String, String>,
    commander_roles: HashMap<String, HashMap<String, String>>,
    pending_player_ships: Vec<PendingPlayerShip>,
    pending_npc_stations: Vec<PendingNpcStation>,
    pending_npc_buildstorages: Vec<PendingNpcBuildStorage>,
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
            connection_stack: VecDeque::new(),
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
            research: ResearchParser::default(),
            terraforming: TerraformingParser::default(),
            blueprints: BlueprintsParser::default(),
            faction: FactionParser::default(),
            universe_closed: false,
            component_kinds: HashMap::new(),
            connection_commanders: HashMap::new(),
            commander_roles: HashMap::new(),
            pending_player_ships: Vec::new(),
            pending_npc_stations: Vec::new(),
            pending_npc_buildstorages: Vec::new(),
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
            let component_id = normalize_component_id(a.get("id"));
            if let Some(id) = component_id.clone() {
                if cls == "station" {
                    self.component_kinds
                        .insert(id, PlayerShipCommanderKind::Station);
                } else if cls.starts_with("ship_") {
                    self.component_kinds
                        .insert(id, PlayerShipCommanderKind::Ship);
                }
            }
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
                id: component_id,
                spawntime: a
                    .get("spawntime")
                    .and_then(|value| value.parse::<f64>().ok())
                    .map(f64::to_bits),
                listener_ids: Vec::new(),
                code: a.get("code").cloned(),
                name: a.get("name").cloned(),
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
                override_max_totals: HashMap::new(),
                override_buy_totals: HashMap::new(),
                override_sell_totals: HashMap::new(),
                build_target_station_component_id: None,
                build_constructions: Vec::new(),
                build_progress: None,
                workforces: Vec::new(),
                trade_offers: Vec::new(),
                subordinate_group: None,
                subordinate_roles: HashMap::new(),
                commander_ref: None,
                default_order: None,
                orders: Vec::new(),
                current_order: None,
                is_repeat: false,
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
                    player_ships: HashMap::new(),
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

        if name == "connection" {
            let kind = a.get("connection").cloned().unwrap_or_default();
            if kind == "subordinates" {
                if let (Some(connection_id), Some(commander_id)) = (
                    normalize_component_id(a.get("id")),
                    self.comp_stack.back().and_then(|ctx| ctx.id.clone()),
                ) {
                    self.connection_commanders
                        .insert(connection_id, commander_id);
                }
            }
            self.connection_stack.push_back(ConnectionCtx { kind });
        }

        if name == "connected"
            && self.connection_stack.back().map(|ctx| ctx.kind.as_str()) == Some("commander")
        {
            let commander_ref = normalize_component_id(a.get("connection"));
            if let Some(ship) = self.comp_stack.back_mut() {
                if ship.class.starts_with("ship_") && ship.owner.as_deref() == Some("player") {
                    ship.commander_ref = commander_ref;
                }
            }
        }

        if at_tags(&self.path, &["component", "listeners", "listener"]) {
            if let Some(station) = self.comp_stack.back_mut() {
                if station.class == "station" {
                    if let Some(listener_id) = normalize_component_id(a.get("listener")) {
                        station.listener_ids.push(listener_id);
                    }
                }
            }
        }

        if at_tags(&self.path, &["component", "subordinate"]) {
            if let Some(ship) = self.comp_stack.back_mut() {
                if ship.class.starts_with("ship_") && ship.owner.as_deref() == Some("player") {
                    ship.subordinate_group = a.get("group").cloned();
                }
            }
        }

        if at_tags(&self.path, &["component", "subordinates", "group"]) {
            if let (Some(index), Some(role)) = (
                a.get("index").cloned(),
                a.get("assignmment")
                    .or_else(|| a.get("assignment"))
                    .cloned(),
            ) {
                if let Some(commander) = self.comp_stack.back_mut() {
                    commander.subordinate_roles.insert(index, role);
                }
            }
        }

        if at_tags(&self.path, &["component", "orders"]) {
            if let Some(ship) = self.comp_stack.back_mut() {
                if ship.class.starts_with("ship_") && ship.owner.as_deref() == Some("player") {
                    ship.is_repeat = a.get("loop") == Some(&"1".to_string())
                        || a.get("recurring") == Some(&"1".to_string());
                }
            }
        }

        if at_tags(&self.path, &["component", "orders", "order"]) {
            if let Some(ship) = self.comp_stack.back_mut() {
                if ship.class.starts_with("ship_") && ship.owner.as_deref() == Some("player") {
                    ship.is_repeat = ship.is_repeat
                        || a.get("loop") == Some(&"1".to_string())
                        || a.get("recurring") == Some(&"1".to_string());
                    ship.current_order = Some((
                        a.get("default") == Some(&"1".to_string()),
                        PlayerShipOrderSummary {
                            id: normalize_component_id(a.get("id")).unwrap_or_default(),
                            order: a.get("order").cloned().unwrap_or_default(),
                            state: a.get("state").cloned(),
                            failed: a.get("failed") == Some(&"1".to_string()),
                            targets: Vec::new(),
                        },
                    ));
                }
            }
        }

        if at_tags(&self.path, &["component", "orders", "order", "param"])
            && a.get("type").map(|value| value.as_str()) == Some("component")
        {
            if let (Some(name), Some(value)) = (
                a.get("name").cloned(),
                normalize_component_id(a.get("value")),
            ) {
                if let Some((_, order)) = self
                    .comp_stack
                    .back_mut()
                    .and_then(|ship| ship.current_order.as_mut())
                {
                    order.targets.push(PlayerShipOrderTarget { name, value });
                }
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

            if at_tags(&self.path, &["component", "overrides", "max", "ware"]) {
                if let Some(station) = self.current_station_ctx_mut() {
                    if let Some(ware) = a.get("ware").cloned() {
                        let amount = to_int(a.get("amount"), 1);
                        *station.override_max_totals.entry(ware).or_insert(0) += amount;
                    }
                }
            }

            if at_tags(&self.path, &["component", "overrides", "buy", "ware"]) {
                if let Some(station) = self.current_station_ctx_mut() {
                    if let Some(ware) = a.get("ware").cloned() {
                        let amount = to_int(a.get("amount"), 1);
                        *station.override_buy_totals.entry(ware).or_insert(0) += amount;
                    }
                }
            }

            if at_tags(&self.path, &["component", "overrides", "sell", "ware"]) {
                if let Some(station) = self.current_station_ctx_mut() {
                    if let Some(ware) = a.get("ware").cloned() {
                        let amount = to_int(a.get("amount"), 1);
                        *station.override_sell_totals.entry(ware).or_insert(0) += amount;
                    }
                }
            }

            let parent_is_cargo = self
                .path
                .get(self.path.len().saturating_sub(2))
                .map(|tag| tag.as_str())
                == Some("cargo");
            if parent_is_cargo {
                let enclosing_ship_index = self
                    .comp_stack
                    .iter()
                    .rposition(|ctx| ctx.class.starts_with("ship_"));
                if let Some(index) = enclosing_ship_index {
                    if let Some(ship) = self.comp_stack.get_mut(index) {
                        if ship.owner.as_deref() == Some("player") {
                            if let Some(ware) = a.get("ware").cloned() {
                                let amount = to_int(a.get("amount"), 1);
                                *ship.cargo_totals.entry(ware).or_insert(0) += amount;
                            }
                        }
                    }
                } else if let Some(component) = self.comp_stack.back() {
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

        if at_tags(
            &self.path,
            &["component", "trade", "offers", "production", "trade"],
        ) {
            let side = match (a.contains_key("buyer"), a.contains_key("seller")) {
                (true, false) => Some("buy"),
                (false, true) => Some("sell"),
                _ => None,
            };
            if let (
                Some(trade_id),
                Some(ware),
                Some(side),
                Some(price),
                Some(amount),
                Some(desired),
            ) = (
                normalize_component_id(a.get("id")),
                a.get("ware").cloned(),
                side,
                a.get("price").and_then(|value| value.parse::<i64>().ok()),
                a.get("amount").and_then(|value| value.parse::<i64>().ok()),
                a.get("desired").and_then(|value| value.parse::<i64>().ok()),
            ) {
                if let Some(holder) = self.comp_stack.back_mut() {
                    if holder.class == "station" || holder.class == "buildstorage" {
                        holder.trade_offers.push(NpcTradeOffer {
                            trade_id,
                            ware,
                            side: side.into(),
                            price: price as f64 / 100.0,
                            amount,
                            desired,
                            flags: a
                                .get("flags")
                                .map(|flags| {
                                    flags
                                        .split('|')
                                        .filter(|flag| !flag.is_empty())
                                        .map(str::to_owned)
                                        .collect()
                                })
                                .unwrap_or_default(),
                        });
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

        self.research.open(
            name,
            a,
            &self.path,
            self.is_inside_player_component(),
            self.is_inside_research_production(),
        );

        let terraforming_cluster_id = if name == "terraforming" {
            self.comp_stack
                .iter()
                .rev()
                .find(|ctx| ctx.class == "cluster")
                .and_then(|ctx| ctx.macro_field.clone())
        } else {
            None
        };
        self.terraforming
            .open(name, a, &self.path, terraforming_cluster_id);

        self.blueprints.open(name, a, &self.path);

        self.faction.open(name, a, &self.path);

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

        if name == "order" {
            if let Some(ship) = self.comp_stack.back_mut() {
                if let Some((is_default, order)) = ship.current_order.take() {
                    if is_default {
                        ship.default_order = Some(order);
                    } else {
                        ship.orders.push(order);
                    }
                }
            }
        }

        if name == "connection" {
            self.connection_stack.pop_back();
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

            if let Some(component_id) = ctx.id.clone() {
                if ctx.class == "station" || ctx.class.starts_with("ship_") {
                    self.commander_roles
                        .insert(component_id, ctx.subordinate_roles.clone());
                }
            }

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
                                        overrides: station_trade_overrides(&ctx),
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
                                        trade_offers: ctx.trade_offers.clone(),
                                        build_storage: None,
                                    };
                                    if let Some(spawntime) = ctx.spawntime.clone() {
                                        self.pending_npc_stations.push(PendingNpcStation {
                                            sector_id: sk.clone(),
                                            station_code: entry.base.code.clone(),
                                            spawntime,
                                            listener_ids: ctx.listener_ids.clone(),
                                        });
                                    }
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
                            } else if let (Some(component_id), Some(code), Some(spawntime)) =
                                (ctx.id.clone(), ctx.code.clone(), ctx.spawntime.clone())
                            {
                                self.pending_npc_buildstorages.push(PendingNpcBuildStorage {
                                    spawntime,
                                    entry: NpcBuildStorageEntry {
                                        component_id,
                                        code,
                                        trade_offers: ctx.trade_offers.clone(),
                                    },
                                });
                            }
                        }
                        _ => {
                            if ctx.class.starts_with("ship_")
                                && ctx.owner.as_deref() == Some("player")
                            {
                                let component_id = ctx.id.clone().unwrap_or_default();
                                self.pending_player_ships.push(PendingPlayerShip {
                                    sector_id: sk.clone(),
                                    entry: PlayerShipEntry {
                                        component_id: component_id.clone(),
                                        code: ctx.code.clone().unwrap_or_default(),
                                        name: ctx.name.clone(),
                                        macro_field: ctx.macro_field.clone().unwrap_or_default(),
                                        class: ctx.class.clone(),
                                        cargo: player_ship_cargo(&ctx.cargo_totals),
                                        assignment: PlayerShipAssignment {
                                            state: PlayerShipAssignmentState::None,
                                            commander_id: None,
                                            commander_kind: None,
                                            commander_ref: None,
                                            role: None,
                                        },
                                        default_order: ctx.default_order.clone(),
                                        orders: ctx.orders.clone(),
                                        is_repeat: ctx.is_repeat,
                                    },
                                    commander_ref: ctx.commander_ref.clone(),
                                    subordinate_group: ctx.subordinate_group.clone(),
                                });
                            } else if ctx
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

        self.research.close(name, &self.path);
        self.terraforming.close(name);
        self.blueprints.close(name);
        self.faction.close(name);

        if name == "universe" {
            self.universe_closed = true;
        }

        self.path.pop_back();
        Ok(())
    }

    pub(crate) fn should_stop_after_universe(&self) -> bool {
        self.universe_closed
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

        let mut sectors = self.sectors.clone();
        for pending in &self.pending_player_ships {
            let mut entry = pending.entry.clone();
            entry.assignment = self.resolve_player_ship_assignment(pending);
            if let Some(sector) = sectors.get_mut(&pending.sector_id) {
                sector
                    .player_ships
                    .insert(entry.component_id.clone(), entry);
            }
        }

        let mut buildstorage_indices = HashMap::<(String, u64), Vec<usize>>::new();
        for (index, pending) in self.pending_npc_buildstorages.iter().enumerate() {
            buildstorage_indices
                .entry((
                    pending.entry.component_id.clone(),
                    pending.spawntime.clone(),
                ))
                .or_default()
                .push(index);
        }
        let station_matches = self
            .pending_npc_stations
            .iter()
            .map(|station| {
                let candidates = station
                    .listener_ids
                    .iter()
                    .filter_map(|listener_id| {
                        buildstorage_indices.get(&(listener_id.clone(), station.spawntime))
                    })
                    .flatten()
                    .copied()
                    .collect::<HashSet<_>>();
                (candidates.len() == 1).then(|| *candidates.iter().next().unwrap())
            })
            .collect::<Vec<_>>();
        let mut match_counts = HashMap::<usize, usize>::new();
        for index in station_matches.iter().flatten() {
            *match_counts.entry(*index).or_default() += 1;
        }
        for (station, buildstorage_index) in self
            .pending_npc_stations
            .iter()
            .zip(station_matches.into_iter())
        {
            let Some(index) = buildstorage_index else {
                continue;
            };
            if match_counts.get(&index) != Some(&1) {
                continue;
            }
            if let Some(entry) = sectors
                .get_mut(&station.sector_id)
                .and_then(|sector| sector.npc_stations.get_mut(&station.station_code))
            {
                entry.build_storage = Some(self.pending_npc_buildstorages[index].entry.clone());
            }
        }

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
                parser_version: "v12".into(),
                post_processor_version: None,
                source: "original".into(),
            },
            sectors,
            is_compatible,
            is_valid: true,
            research: self.research.runtime().clone(),
            terraforming_clusters: self.terraforming.clusters().clone(),
            player_blueprints: self.blueprints.blueprints().clone(),
            player_relations: self.faction.relations().clone(),
            player_licences: self.faction.licences().clone(),
        })
    }

    fn resolve_player_ship_assignment(&self, pending: &PendingPlayerShip) -> PlayerShipAssignment {
        let Some(commander_ref) = pending.commander_ref.clone() else {
            if pending.subordinate_group.is_some() {
                return PlayerShipAssignment {
                    state: PlayerShipAssignmentState::Unresolved,
                    commander_id: None,
                    commander_kind: None,
                    commander_ref: None,
                    role: None,
                };
            }
            return PlayerShipAssignment {
                state: PlayerShipAssignmentState::None,
                commander_id: None,
                commander_kind: None,
                commander_ref: None,
                role: None,
            };
        };
        let Some(commander_id) = self.connection_commanders.get(&commander_ref).cloned() else {
            return PlayerShipAssignment {
                state: PlayerShipAssignmentState::Unresolved,
                commander_id: None,
                commander_kind: None,
                commander_ref: Some(commander_ref),
                role: None,
            };
        };
        let Some(commander_kind) = self.component_kinds.get(&commander_id).cloned() else {
            return PlayerShipAssignment {
                state: PlayerShipAssignmentState::Unresolved,
                commander_id: Some(commander_id),
                commander_kind: None,
                commander_ref: Some(commander_ref),
                role: None,
            };
        };
        let role = pending.subordinate_group.as_ref().and_then(|group| {
            self.commander_roles
                .get(&commander_id)
                .and_then(|roles| roles.get(group))
                .cloned()
        });

        PlayerShipAssignment {
            state: PlayerShipAssignmentState::Resolved,
            commander_id: Some(commander_id),
            commander_kind: Some(commander_kind),
            commander_ref: Some(commander_ref),
            role,
        }
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

    fn is_inside_player_component(&self) -> bool {
        self.comp_stack.iter().any(|ctx| ctx.class == "player")
    }

    fn is_inside_research_production(&self) -> bool {
        self.comp_stack.iter().any(|ctx| {
            ctx.class == "production"
                && ctx.macro_field.as_deref() == Some("landmarks_player_hq_01_research_macro")
        })
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

fn player_ship_cargo(input: &HashMap<String, i64>) -> Vec<PlayerShipCargo> {
    let mut cargo = input
        .iter()
        .map(|(ware, amount)| PlayerShipCargo {
            ware: ware.clone(),
            amount: *amount,
        })
        .collect::<Vec<_>>();
    cargo.sort_by(|a, b| a.ware.cmp(&b.ware));
    cargo
}

fn station_trade_overrides(ctx: &ComponentCtx) -> Option<StationTradeOverrides> {
    let overrides = StationTradeOverrides {
        max: ware_amounts(&ctx.override_max_totals),
        buy: ware_amounts(&ctx.override_buy_totals),
        sell: ware_amounts(&ctx.override_sell_totals),
    };
    if overrides.is_empty() {
        None
    } else {
        Some(overrides)
    }
}
