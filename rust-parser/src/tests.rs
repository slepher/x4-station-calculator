#[cfg(test)]
mod tests {
    use crate::core::SaveParserCore;
    use crate::stream::StreamingSaveParser;

    #[test]
    fn parses_uppercase_station_attributes_like_js_parser() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component CLASS="station" MACRO="station_macro" OWNER="player" CODE="AAA" FACTIONHEADQUARTERS="1"><offset><position X="1" Y="2" Z="3"/></offset></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(1024) {}

        let archive = parser.finish_archive("save.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");
        let station = sector.stations.first().expect("station");

        assert_eq!(station.owner, "player");
        assert_eq!(station.code, "AAA");
        assert_eq!(station.macro_field, "station_macro");
        assert_eq!(station.is_headquarter, Some(true));
        assert_eq!((station.x, station.y, station.z), (1.0, 2.0, 3.0));
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
        let station = &archive.sectors["sec_alpha"].stations[0];
        let module = &station.modules[0];

        assert_eq!((station.x, station.y, station.z), (4.0, 5.0, 6.0));
        assert_eq!(module.index, 1);
        assert_eq!(module.ref_field, "mod_macro");
        assert_eq!(module.equipments[0].ref_field, "shield_macro");
        assert_eq!(module.equipments[0].exact, 2);
    }
}
