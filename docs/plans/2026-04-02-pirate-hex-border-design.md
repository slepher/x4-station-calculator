# Pirate Hex Border Design

## Goal

Extract the border language from the pirate station icons into two reusable SVG assets:

- `hex.svg`: rounded regular hexagon border
- `hex_headquarters.svg`: the same border with one rectangular cut removed from each side

## Geometry

- Canvas: `128x128`
- Center: `(64, 64)`
- Hexagon type: regular flat-top hexagon
- Radius: `48`
- Stroke width: `8`
- Join style: `round`

## Variants

- `hex.svg` keeps the border continuous.
- `hex_headquarters.svg` uses a mask to subtract one small rectangle from each edge, matching the interrupted-border feel of the existing headquarters icon.

## Rendering

- Background remains black for consistency with existing icon assets.
- Border remains white.
