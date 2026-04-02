#[cfg(test)]
mod tests {
    use crate::core::SaveParserCore;
    use crate::stream::StreamingSaveParser;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    #[test]
    fn parses_uppercase_station_attributes_like_js_parser() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component CLASS="station" MACRO="station_macro" OWNER="player" CODE="AAA" FACTIONHEADQUARTERS="1"><offset><position X="1" Y="2" Z="3"/></offset></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(1024) {}

        let archive = parser.finish_archive("save.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");
        let station = sector.player_stations.first().expect("station");

        assert_eq!(station.base.owner, "player");
        assert_eq!(station.base.code, "AAA");
        assert_eq!(station.base.macro_field, "station_macro");
        assert_eq!(station.base.is_headquarter, Some(true));
        assert_eq!((station.base.x, station.base.y, station.base.z), (1.0, 2.0, 3.0));
    }

    #[test]
    fn no_expected_version_means_compatible() {
        let mut core = SaveParserCore::new(None);
        core.meta.version = "7.0".into();

        let archive = core.finish_archive("legacy.xml").expect("archive");

        assert!(archive.is_compatible);
    }

    #[test]
    fn parses_across_small_chunks() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><offset><position x="4" y="5" z="6"/></offset><construction><sequence><entry index="1" macro="mod_macro"><upgrades><groups><shields macro="shield_macro" group="g1" exact="2"/></groups></upgrades></entry></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        for chunk in xml.as_bytes().chunks(7) {
            parser.push_chunk(chunk);
            let _ = parser.pump(8);
        }
        parser.finish_input();
        while parser.pump(8) {}

        let archive = parser.finish_archive("chunked.xml").expect("archive");
        let station = &archive.sectors["sec_alpha"].player_stations[0];
        let module = &station.modules[0];

        assert_eq!((station.base.x, station.base.y, station.base.z), (4.0, 5.0, 6.0));
        assert_eq!(module.index, 1);
        assert_eq!(module.ref_field, "mod_macro");
        assert_eq!(module.equipments[0].ref_field, "shield_macro");
        assert_eq!(module.equipments[0].exact, 2);
    }

    #[test]
    fn progress_percent_uses_expected_total_bytes_when_available() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" known="1"></component></savegame>"#;
        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len() * 2);
        parser.push_chunk(xml.as_bytes());
        let _ = parser.pump(4096);

        let progress: serde_json::Value =
            serde_json::from_str(&parser.progress_json()).expect("progress json");

        let percent = progress["percent"].as_f64().expect("percent");
        assert!(percent > 40.0 && percent < 60.0, "percent was {percent}");
    }

    #[test]
    fn pump_stops_when_waiting_for_more_stream_input() {
        let partial = b"<savegame><info><game";
        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(partial);

        let has_more = parser.pump(4096);

        assert!(!has_more);
    }

    #[test]
    fn cli_progress_is_emitted_only_when_rust_progress_bucket_changes() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><offset><position x="1" y="2" z="3"/></offset></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len() * 100);
        parser.push_chunk(xml.as_bytes());

        let initial = parser.take_cli_progress_json();
        assert!(!initial.is_empty());

        let _ = parser.pump(1);
        let progress_a = parser.take_cli_progress_json();

        let _ = parser.pump(1);
        let progress_b = parser.take_cli_progress_json();

        assert!(progress_a.is_empty() || progress_b.is_empty());

        parser.finish_input();
        while parser.pump(4096) {}

        let final_progress = parser.take_cli_progress_json();
        assert!(!final_progress.is_empty());
        assert!(final_progress.contains(r#""done":true"#));
    }

    #[test]
    fn parses_gzip_input_stream_inside_rust_parser() {
        let xml = r#"<savegame><info><game guid="GUID-3" seed="7" time="8" version="8.0"/><player name="gzip"/></info><component class="sector" macro="gzip_sector" known="1"><component class="station" macro="gzip_station" code="GZIP-1" owner="player"><offset><position x="11" y="22" z="33"/></offset></component></component></savegame>"#;
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(xml.as_bytes()).expect("write gzip");
        let gzipped = encoder.finish().expect("finish gzip");

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len());
        for chunk in gzipped.chunks(9) {
            parser.push_chunk(chunk);
            let _ = parser.pump(64);
        }
        parser.finish_input();
        while parser.pump(1024) {}

        let archive = parser.finish_archive("gzip.xml.gz").expect("archive");
        let station = &archive.sectors["gzip_sector"].player_stations[0];

        assert_eq!(archive.meta.player_name, "gzip");
        assert_eq!(station.base.code, "GZIP-1");
        assert_eq!((station.base.x, station.base.y, station.base.z), (11.0, 22.0, 33.0));
    }

    #[test]
    fn aggregates_modules_for_xenon_and_khaak_stations() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="xen_station" owner="xenon" code="XEN-1"><construction><sequence><entry index="1" macro="buildmodule_xen_ships_xl_macro"/><entry index="2" macro="buildmodule_xen_ships_xl_macro"/></sequence></construction></component><component class="station" macro="kha_station" owner="khaak" code="KHA-1"><construction><sequence><entry index="1" macro="module_khaak_special"/><entry index="2" macro="module_khaak_special"/></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("factions.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");

        assert_eq!(sector.xenon_stations[0].modules[0].ref_field, "buildmodule_xen_ships_xl_macro");
        assert_eq!(sector.xenon_stations[0].modules[0].amount, 2);
        assert_eq!(sector.khaak_stations[0].modules[0].ref_field, "module_khaak_special");
        assert_eq!(sector.khaak_stations[0].modules[0].amount, 2);
    }
}
