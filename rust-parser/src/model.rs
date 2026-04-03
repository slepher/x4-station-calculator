use serde::{Deserialize, Serialize};
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
#[serde(rename_all = "camelCase")]
pub(crate) struct PlayerStationConstruction {
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
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) z: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) is_wreck: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) is_headquarter: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct PlayerStationEntry {
    #[serde(flatten)]
    pub(crate) base: StationBaseEntry,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) constructions: Vec<PlayerStationConstruction>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) modules: Vec<AggregatedStationModule>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) equipments: Vec<AggregatedEquipment>,
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
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) z: f64,
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
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) z: f64,
}

#[derive(Clone, Serialize, Default)]
pub(crate) struct SectorData {
    pub(crate) name: String,
    pub(crate) is_known: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) owner: Option<String>,
    #[serde(rename = "playerStations", skip_serializing_if = "Vec::is_empty")]
    pub(crate) player_stations: Vec<PlayerStationEntry>,
    #[serde(rename = "xenonStations", skip_serializing_if = "Vec::is_empty")]
    pub(crate) xenon_stations: Vec<FactionStationEntry>,
    #[serde(rename = "khaakStations", skip_serializing_if = "Vec::is_empty")]
    pub(crate) khaak_stations: Vec<FactionStationEntry>,
    #[serde(rename = "npcStations", skip_serializing_if = "Vec::is_empty")]
    pub(crate) npc_stations: Vec<NpcStationEntry>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) datavaults: Vec<DatavaultEntry>,
    #[serde(rename = "erlkingVaults")]
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) erlking_vaults: Vec<DatavaultEntry>,
    #[serde(rename = "abandonedShips")]
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) abandoned_ships: Vec<AbandonedShipEntry>,
}

#[derive(Clone, Serialize)]
pub(crate) struct SaveArchive {
    pub(crate) meta: ArchiveMeta,
    pub(crate) sectors: HashMap<String, SectorData>,
    #[serde(rename = "isCompatible")]
    pub(crate) is_compatible: bool,
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
    pub(crate) source: String,
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
