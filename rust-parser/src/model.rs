use serde::{Deserialize, Serialize, Serializer};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ParsePhase {
    Receiving,
    Parsing,
    Finalizing,
    Done,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub(crate) enum ErrorDetail {
    VersionMismatch {
        save_version: String,
        save_version_normalized: String,
        expected_version: String,
        expected_version_normalized: String,
    },
    ParseError {
        message: String,
    },
}

#[derive(Clone, Debug)]
pub(crate) struct ParserError {
    pub(crate) detail: ErrorDetail,
}

impl ParserError {
    pub(crate) fn version_mismatch(
        save_version: String,
        save_version_normalized: String,
        expected_version: String,
        expected_version_normalized: String,
    ) -> Self {
        Self {
            detail: ErrorDetail::VersionMismatch {
                save_version,
                save_version_normalized,
                expected_version,
                expected_version_normalized,
            },
        }
    }

    pub(crate) fn parse_error(message: impl Into<String>) -> Self {
        Self {
            detail: ErrorDetail::ParseError {
                message: message.into(),
            },
        }
    }
}

impl std::fmt::Display for ParserError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.detail {
            ErrorDetail::VersionMismatch {
                save_version,
                save_version_normalized,
                expected_version,
                expected_version_normalized,
            } => write!(
                f,
                "Version mismatch: save version {} ({}) does not match current game version {} ({})",
                save_version, save_version_normalized, expected_version, expected_version_normalized
            ),
            ErrorDetail::ParseError { message } => write!(f, "{}", message),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProgressInfo {
    pub(crate) phase: ParsePhase,
    pub(crate) input_bytes_total: usize,
    pub(crate) parsed_bytes_total: usize,
    pub(crate) buffered_bytes: usize,
    pub(crate) expected_total_bytes: usize,
    pub(crate) percent: f64,
    pub(crate) tag_count: usize,
    pub(crate) sector_count: usize,
    pub(crate) done: bool,
    pub(crate) input_complete: bool,
    pub(crate) error: Option<String>,
    pub(crate) error_detail: Option<ErrorDetail>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub(crate) struct Vector3 {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) z: f64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct WareAmount {
    pub(crate) ware: String,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct StationTradeOverrides {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) max: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) buy: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) sell: Vec<WareAmount>,
}

impl StationTradeOverrides {
    pub(crate) fn is_empty(&self) -> bool {
        self.max.is_empty() && self.buy.is_empty() && self.sell.is_empty()
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct WorkforceEntry {
    pub(crate) race: String,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub(crate) struct Meta {
    pub(crate) guid: String,
    pub(crate) seed: i64,
    pub(crate) time: f64,
    #[serde(rename = "playerName")]
    pub(crate) player_name: String,
    pub(crate) version: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct PlayerStationConstruction {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) index: i64,
    #[serde(rename = "ref")]
    pub(crate) ref_field: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) predecessor: Option<i64>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) equipments: Vec<StationEquipment>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct AggregatedEquipment {
    #[serde(rename = "type")]
    pub(crate) equip_type: String,
    #[serde(rename = "ref")]
    pub(crate) ref_field: String,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct StationEquipment {
    #[serde(rename = "type")]
    pub(crate) equip_type: String,
    #[serde(rename = "ref")]
    pub(crate) ref_field: String,
    pub(crate) group: String,
    pub(crate) exact: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct StationBaseEntry {
    pub(crate) code: String,
    #[serde(rename = "macro")]
    pub(crate) macro_field: String,
    pub(crate) owner: String,
    pub(crate) relative_position: Vector3,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) zone_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) is_wreck: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) is_headquarter: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct BuildProgress {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) start: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) end: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) sequenceindex: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct BuildStorageEntry {
    pub(crate) component_id: String,
    pub(crate) code: String,
    pub(crate) owner: String,
    pub(crate) relative_position: Vector3,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) zone_id: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) cargo: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) reservation: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) station_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) target_station_component_id: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) constructions: Vec<PlayerStationConstruction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) progress: Option<BuildProgress>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct PlayerStationEntry {
    #[serde(flatten)]
    pub(crate) base: StationBaseEntry,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) component_id: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) constructions: Vec<PlayerStationConstruction>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) cargo: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) reservation: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) overrides: Option<StationTradeOverrides>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) buildstorage_code: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) workforces: Vec<WorkforceEntry>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct FactionStationEntry {
    #[serde(flatten)]
    pub(crate) base: StationBaseEntry,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) modules: Vec<AggregatedStationModule>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) equipments: Vec<AggregatedEquipment>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct AggregatedStationModule {
    #[serde(rename = "ref")]
    pub(crate) ref_field: String,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct NpcStationEntry {
    #[serde(flatten)]
    pub(crate) base: StationBaseEntry,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) modules: Vec<AggregatedStationModule>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) equipments: Vec<AggregatedEquipment>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct DatavaultWareEntry {
    pub(crate) ware: String,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct DatavaultEntry {
    pub(crate) code: String,
    #[serde(rename = "macro")]
    pub(crate) macro_field: String,
    pub(crate) owner: String,
    pub(crate) relative_position: Vector3,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) zone_id: Option<String>,
    pub(crate) unlocked: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) wares: Vec<DatavaultWareEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) has_blueprints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) has_wares: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) has_signalleak: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct AbandonedShipEntry {
    pub(crate) code: String,
    #[serde(rename = "macro")]
    pub(crate) macro_field: String,
    pub(crate) class: String,
    pub(crate) relative_position: Vector3,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) zone_id: Option<String>,
}

#[derive(Clone, Serialize, Default)]
pub(crate) struct SectorData {
    pub(crate) name: String,
    pub(crate) is_known: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) owner: Option<String>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) player_stations: HashMap<String, PlayerStationEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) xenon_stations: HashMap<String, FactionStationEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) khaak_stations: HashMap<String, FactionStationEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) npc_stations: HashMap<String, NpcStationEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) player_buildstorages: HashMap<String, BuildStorageEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) datavaults: HashMap<String, DatavaultEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) erlking_vaults: HashMap<String, DatavaultEntry>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub(crate) abandoned_ships: HashMap<String, AbandonedShipEntry>,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveResearchRuntime {
    pub(crate) visible_ids: Vec<String>,
    pub(crate) completed_ids: Vec<String>,
    #[serde(serialize_with = "serialize_option_str_or_null")]
    pub(crate) active_id: Option<String>,
}

fn serialize_option_str_or_null<S: Serializer>(
    v: &Option<String>,
    s: S,
) -> Result<S::Ok, S::Error> {
    match v {
        Some(val) => s.serialize_str(val),
        None => s.serialize_none(),
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct SaveTerraformingRebateAmount {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ware: Option<String>,
    #[serde(rename = "wareGroup")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ware_group: Option<String>,
    pub(crate) amount: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct SaveTerraformingEventProgress {
    #[serde(rename = "eventId")]
    pub(crate) event_id: String,
    #[serde(rename = "completedCount")]
    pub(crate) completed_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "startTime")]
    pub(crate) start_time: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct SaveTerraformingProjectProgress {
    #[serde(rename = "projectId")]
    pub(crate) project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) aborted: Option<bool>,
    #[serde(rename = "scaledResources")]
    pub(crate) scaled_resources: Vec<WareAmount>,
    #[serde(rename = "submittedResources")]
    pub(crate) submitted_resources: Vec<WareAmount>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "inTransitResources")]
    pub(crate) in_transit_resources: Option<Vec<WareAmount>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "inTransitShipBatches")]
    pub(crate) in_transit_ship_batches: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct SaveTerraformingCompletedProject {
    #[serde(rename = "projectId")]
    pub(crate) project_id: String,
    #[serde(rename = "completedCount")]
    pub(crate) completed_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "startTime")]
    pub(crate) start_time: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct SaveTerraformingCluster {
    #[serde(rename = "clusterId")]
    pub(crate) cluster_id: String,
    pub(crate) part: String,
    pub(crate) seed: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "missionCue")]
    pub(crate) mission_cue: Option<String>,
    #[serde(rename = "missionComplete")]
    pub(crate) mission_complete: bool,
    pub(crate) stats: HashMap<String, f64>,
    pub(crate) rebates: Vec<SaveTerraformingRebateAmount>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "activeProject")]
    pub(crate) active_project: Option<SaveTerraformingProjectProgress>,
    #[serde(rename = "completedProjects")]
    pub(crate) completed_projects: Vec<SaveTerraformingCompletedProject>,
    #[serde(rename = "retainedProjects")]
    pub(crate) retained_projects: Vec<SaveTerraformingProjectProgress>,
    pub(crate) events: Vec<SaveTerraformingEventProgress>,
}

#[derive(Clone, Serialize)]
pub(crate) struct ArchiveMeta {
    pub(crate) guid: String,
    pub(crate) seed: i64,
    pub(crate) time: f64,
    #[serde(rename = "playerName")]
    pub(crate) player_name: String,
    pub(crate) version: String,
    pub(crate) filename: String,
    #[serde(rename = "parser_version")]
    pub(crate) parser_version: String,
    #[serde(
        rename = "post_processor_version",
        skip_serializing_if = "Option::is_none"
    )]
    pub(crate) post_processor_version: Option<String>,
    pub(crate) source: String,
}

#[derive(Clone, Serialize)]
pub(crate) struct SaveArchive {
    pub(crate) meta: ArchiveMeta,
    pub(crate) sectors: HashMap<String, SectorData>,
    #[serde(rename = "isCompatible")]
    pub(crate) is_compatible: bool,
    #[serde(rename = "isValid")]
    pub(crate) is_valid: bool,
    pub(crate) research: SaveResearchRuntime,
    #[serde(rename = "terraforming_clusters")]
    pub(crate) terraforming_clusters: HashMap<String, SaveTerraformingCluster>,
}

pub(crate) fn norm_ver(v: &str) -> String {
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
