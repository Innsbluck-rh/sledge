# Sledge

[![release](https://github.com/Innsbluck-rh/sledge/actions/workflows/release.yml/badge.svg)](https://github.com/Innsbluck-rh/sledge/actions/workflows/release.yml)
&nbsp;
[![dev](https://github.com/Innsbluck-rh/sledge/actions/workflows/dev.yml/badge.svg)](https://github.com/Innsbluck-rh/sledge/actions/workflows/dev.yml)
&nbsp;
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/sledge-gold)
&nbsp;
![GitHub Release](https://img.shields.io/github/v/release/Innsbluck-rh/sledge)

<div align="center">

<br>

<img src="assets/0827sledge_dark.png" alt="the visual of sledge." width=600 />

<br>
Sledge is a drawing tool.

**Simple.**&nbsp;&nbsp;&nbsp;**Fast.**&nbsp;&nbsp;&nbsp;**Destructive.**

</div>

<br>

## Platform Support

| Platform | Status                  | Detail                                   |
| -------- | ----------------------- | ---------------------------------------- |
| Windows  | :white_check_mark:      | *mostly OK.*                             |
| MacOS    | :white_check_mark:      | *almost OK. there's some ui/ux problem.* |
| Linux    | :ballot_box_with_check: | *NOTOK. barely usable.*                  |
| Mobile   | :zzz:                   | *No builds available.*                   |

## Install

1. Visit [sledge-rules.app](https://www.sledge-rules.app/) to download installer.
2. Run the installer and complete install.
3. Run sledge.

<details>

<summary>For Mac users</summary>

MacOS will report an "App is Damaged" error when running sledge by double click.
Run command below to prevent:
```bash
xattr -rc /Applications/sledge.app
```

</details>

<br>


## Features

<details>
<summary>WIP status</summary>

| Category         | Feature               | Status | Notes                                                       |
| ---------------- | --------------------- | ------ | ----------------------------------------------------------- |
| **Interactions** | Mouse                 | ✅      |                                                             |
|                  | Pen                   | ✅      |                                                             |
|                  | Touch                 | ✅      | can only zoom/pan because it's assumed to be used with pen. |
|                  | Touchpads             | ⏳      |                                                             |
| **Tools**        | Pen, Eraser           | ✅      |                                                             |
|                  | Fill                  | ✅      |                                                             |
|                  | Color Picker          | ✅      |                                                             |
|                  | Image Pool            | ✅      | resize, transfer to layer                                   |
|                  | Selection             | ✅      | rect, auto                                                  |
|                  | Text                  | ⏳      |                                                             |
| **Composites**   | Layer Opacity         | ✅      |                                                             |
|                  | Layer Blend Mode      | ✅      | normal / multiply / linear light / etc                      |
| **Effects**      | Live Effects          | ⏳      | effects that can be chained and react to the image          |
|                  | Invert                | ✅      | invert layer's colors                                       |
|                  | Gaussian Blur         | ✅      | blur the layer                                              |
|                  | Grayscale             | ✅      | convert the layer to grayscale                              |
| **I/O**          | Basic I/O             | ✅      | load, save, import, export                                  |
|                  | SVG Export            | ✅      | vector export for small pixel art/icons (< 128x128)         |
|                  | Backup                | ⏳      | automatic backup for safe editing                           |
|                  | Clipboard             | ⏳      | selection / layer                                           |
|                  | Drag and Drop         | ⏳      | images (add to pool) / project (open)                       |
|                  | Project-Level History | ⏳      |                                                             |
| **Others**       | Animation             | ⏳      | creating frames and output to gif, mp4                      |

</details>

## Fonts

* [04b_XX](http://www.04.jp.org) by yuji oshimoto (04.jp.org)
* [k12x8 / k8x12](https://littlelimit.net/k12x8.htm) by num_kadoma (littlelimit.net)

## Tech

### Frontend / Website

- [SolidJS](https://github.com/solidjs/solid)
- [Vite](https://github.com/vitejs/vite)

### Backend

- [Tauri](https://github.com/tauri-apps/tauri)

### Image Processing / Layer Composite

- [WASM](https://developer.mozilla.org/ja/docs/WebAssembly) ([wasm-bindgen](https://github.com/wasm-bindgen/wasm-bindgen) / [wasm-pack](https://github.com/drager/wasm-pack))
- [WebGL2](https://developer.mozilla.org/ja/docs/Web/API/WebGL_API)

### Project Format

- [msgpack](https://msgpack.org/ja.html)





