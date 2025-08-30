# Sledge

<img src="./public/readme_intro.png" alt="the picture of a well-drawn sledgehammer." width="500px"/>\

> this project is pre-alpha.  
> feel free to DM me: [@alphendp](https://x.com/alphendp)

## build

if you don't have tauri, install first (https://v2.tauri.app/ja/)

```bash
git clone https://gitlab.com/Innsbluck/sledge.git
cd sledge
npm install # install solidjs dependencies
npm tauri dev # launch
```

## what you'll get

### ■&ensp;&nbsp;pixel-perfect drawing experience

- **no alpha channels**. \
  erasing just works. nothing left behind.

- **dot magnification** factor, such as `x1` or `x4`. \
  it enables you to put some _out-of-place_ pixel art on a high-definition background.

  <!-- some introduction picture for layers -->

### \>\_ &nbsp;useful (or _unstable_) effects

- built-in stuff:

  - **standard effects** — `brightness`, `contrast`, `invert`

  - **filter and split functions** — `splitV`, `colorRange`, `rect`

  - **destructive effects** — `JPEG glitches`

- all effects are written in Rust.

  <!-- some introduction picture for the effects -->

### :)&ensp;companion

- pretty companion improves your drawing experiment.

## DSL(Data Shaping Line)

sledge's DSL(Data Shaping Line) is a flexible and powerful effect pipelines.

```shell
# layer_N: unique id for layerN
# in(layer_N): read the image data from layer.
# out(layer_N): output the image data to layer.

in(layer_0) > out(layer_0)  # do nothing.

in(layer_0) > contrast(20%) > invert() > out(layer_0)  # apply contrast+20%, then invert it.

in(layer_1) > splitV(50%) > multiout(*upper, *lower)  # apply grayscale, split vertically in half.
upper > jpeg_glitch(9, 72) > *merged                # apply jpeg_glitch for the upper half of layer1.
lower > invert() > merged                          # invert the lower half of layer1.
merged > out(layer_1)                               # merge split images and throw back to layer1.

# note 1: *upper, *lower, and *merged are called "subout nodes" (basically like named pipes.)
# note 2: subout nodes automatically merge/override multiple inputs.
```

- supports the GUI node editor to add / swap / mutate effects.
- of course, raw command-line input is also available.\
  either way, dsl effects are applied to the image immediately and reactively.

## tech

- [SolidJS](https://www.solidjs.com/) (UI)
- [Tauri](https://tauri.app/) (desktop wrapper)
- [Rust](https://www.rust-lang.org/) (effect processing)
- [speak.js](https://github.com/kripken/speak.js/) (TTS engine)
