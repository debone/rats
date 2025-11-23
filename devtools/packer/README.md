# Aseprite Texture Packer

A tool for extracting individual layers from Aseprite files and generating Phaser-compatible MultiAtlas files, with special support for 9-slice and other UI component patterns.

## Features

- Extracts individual layers from Aseprite files into separate images
- Automatically crops images to content bounds (removing transparent areas)
- Processes "-slices" layers to create sliced sprites for UI components
- Supports flexible slicing patterns based on content boundaries
- Generates MultiAtlas format JSON metadata for use with Phaser 3
- Preserves layer transparency and positioning
- Ignores utility layers (names starting with "\_" or exactly "Layer")

## Prerequisites

- [Node.js](https://nodejs.org/) 16 or higher
- [npm](https://www.npmjs.com/)

## Usage

From the root of the repository, run:

```bash
npm run packer -- --input <aseprite-file> --output <output-directory> [options]
```

### Options

- `-i, --input`: (Required) Input Aseprite file path
- `-o, --output`: (Required) Output directory for extracted files
- `-n, --name`: Base name for the generated files (default: input filename)
- `-h, --help`: Show help information

### Examples

Basic usage:

```bash
npm run packer -- -i assets/ui.aseprite -o public/assets
```

Custom base name:

```bash
npm run packer -- -i assets/ui.aseprite -o public/assets -n interface
```

## How It Works

This tool:

1. Takes an Aseprite file as input
2. Extracts all visible layers from the first frame
3. Identifies slice layers (layers ending with "-slices") and links them to their corresponding content layers
4. Processes slices to create appropriate frames based on markers and content boundaries
5. Generates separate PNG files for each content layer, cropped to actual content
6. Creates a MultiAtlas JSON file for use with Phaser 3
7. Ignores utility layers (names starting with "\_" or exactly "Layer")

## Layer Naming Convention

The tool follows these naming conventions:

- `button` - Regular content layer
- `button-slices` - Corresponding slice layer for the button
- `_guide` - Ignored (starts with "\_")
- `Layer` - Ignored (default Aseprite layer name)

## Slicing System

The slicing system uses cross markers to determine where to slice UI components:

1. Create a regular layer for your UI element (e.g., `button`)
2. Create a corresponding slice layer with the same name plus "-slices" (e.g., `button-slices`)
3. Draw crosses (intersection of perpendicular lines) where you want to slice the content
4. The tool will detect these crosses and create slice lines, adjusting based on content boundaries

### Cross Markers

A cross marker is a pixel that has non-transparent pixels in all four directions (up, down, left, right):

```
   #
   #
 #####
   #
   #
```

These crosses define the intersections where slices should be created. When a cross marker is found, it creates both a horizontal and vertical slice line at that position.

### Content Boundaries and Slice Lines

The tool intelligently handles crosses that might be outside of content boundaries:

- If a cross is within the content area, it creates both horizontal and vertical slice lines
- If a cross is outside the content area but the slice line intersects the content, it creates the slice
- If a cross is completely outside and its slice lines don't intersect the content, the slice is ignored

Example scenarios:

1. **Full 9-slice**: When crosses are placed within the content area, creating a standard 9-slice component
2. **Horizontal 3-slice**: When crosses create vertical slice lines that intersect the content, but horizontal slices don't
3. **Vertical 3-slice**: When crosses create horizontal slice lines that intersect the content, but vertical slices don't

This approach allows for flexible slicing patterns that adapt to the content's actual dimensions.

## Output Files

For an input file named `ui.aseprite` with layers `button` and `panel`, the tool will generate:

- `ui_button.png` - Image file for the button layer (cropped to content)
- `ui_panel.png` - Image file for the panel layer (cropped to content)
- `ui.json` - MultiAtlas JSON file referencing all layers and frames

## Using with Phaser

In your Phaser game's preload method:

```javascript
// Load the MultiAtlas
this.load.multiatlas("ui", "assets/ui.json");

// Use a regular sprite (frame "0" is the entire layer)
this.add.image(x, y, "ui", "0");

// For sliced components, frame numbers depend on the slice pattern
// For a 9-slice grid (3x3):
this.add.image(x, y, "ui", "0"); // Top-left corner
this.add.image(x, y, "ui", "1"); // Top edge
// etc...

// For a 3-slice horizontal component:
this.add.image(x, y, "ui", "0"); // Left
this.add.image(x, y, "ui", "1"); // Middle
this.add.image(x, y, "ui", "2"); // Right
```

With JSX:

```tsx
{/* Regular sprite */}
<image texture={RESOURCES["ui"]} frame="0" />

{/* 9-slice component example */}
<Flex margin={0} padding={0}>
  <image texture={RESOURCES["ui"]} frame="0" />
  <FlexItem grow={1}>
    <tileSprite texture={RESOURCES["ui"]} frame="1" />
  </FlexItem>
  <image texture={RESOURCES["ui"]} frame="2" />
</Flex>
<FlexItem grow={1}>
  <Flex margin={0} padding={0} align={ALIGN_ITEMS.STRETCH}>
    <tileSprite texture={RESOURCES["ui"]} frame="3" />
    <Spacer grow={1} />
    <tileSprite texture={RESOURCES["ui"]} frame="5" />
  </Flex>
</FlexItem>
<Flex margin={0} padding={0}>
  <image texture={RESOURCES["ui"]} frame="6" />
  <FlexItem grow={1}>
    <tileSprite texture={RESOURCES["ui"]} frame="7" />
  </FlexItem>
  <image texture={RESOURCES["ui"]} frame="8" />
</Flex>
```

## Frame Numbering

The frames are numbered based on the grid created by the slice markers, from top-left to bottom-right. The exact pattern depends on how many valid slices are created:

```
9-slice (3x3 grid):    3-slice horizontal:   3-slice vertical:
0 1 2                  0 1 2                 0
3 4 5                                        1
6 7 8                                        2
```

## MultiAtlas Format

The generated JSON file follows the Phaser 3 MultiAtlas format, which allows:

- Multiple texture files referenced in a single logical atlas
- Each layer as a separate image file to maintain quality
- Numeric frame references for easy access

## Limitations

- Currently only processes the first frame of animations
- For best results, ensure slice marker crosses are clear and distinct
- Image trimming may affect slice coordinates, so place markers precisely
