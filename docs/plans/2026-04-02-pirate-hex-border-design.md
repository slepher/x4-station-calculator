# Pirate Hex Border Design

## Goal

Extract the border language from the pirate station icons into two reusable SVG assets:

- `hexagon.svg`: rounded regular hexagon border
- `hexagon_headquarter.svg`: the same border with one rectangular cut removed from each side

## Geometry

- Canvas: `128x128`
- Center: `(64, 64)`
- Hexagon type: regular flat-top hexagon
- Radius: `48`
- Stroke width: `8`
- Join style: `round`

## Variants

- `hexagon.svg` keeps the border continuous.
- `hexagon_headquarter.svg` matches the interrupted-border feel of the existing headquarter icon.

## Rendering

- Background remains black for consistency with existing icon assets.
- Border remains white.
