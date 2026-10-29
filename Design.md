# LinkVault — Design System & UI Specification

> Dokumen ini adalah **sumber kebenaran desain** untuk LinkVault. Tujuannya: siapa pun (manusia atau AI) bisa membangun ulang tampilan yang sama, atau memakai sistem ini di proyek lain, **tanpa perlu melihat screenshot atau kode aslinya**.
>
> Semua angka (px, warna, durasi) di dokumen ini adalah nilai final yang dipakai di produksi. Kalau ragu, ikuti angka di sini.

---

## 0. Cara memakai dokumen ini (untuk AI)

Baca dengan urutan ini:

1. **Bagian 1–2** → pahami *rasa* desainnya. Jangan lewati; ini yang mencegah hasil terlihat generik.
2. **Bagian 3** → salin token ke `:root`. Jangan mengarang warna baru.
3. **Bagian 4–5** → pakai skala tipografi dan grid apa adanya.
4. **Bagian 6–7** → bangun shell dan komponen. Setiap komponen punya anatomi + state.
5. **Bagian 8** → rakit halaman sesuai blueprint.
6. **Bagian 10–13** → perilaku, aksesibilitas, responsif, motion.
7. **Bagian 14** → cek daftar larangan sebelum selesai.
8. **Bagian 15–17** → CSS starter, pemetaan Tailwind, dan checklist akhir.

Aturan emas: **jangan menambah komponen, warna, shadow, atau animasi yang tidak tercantum di sini.** Desain ini kuat karena disiplinnya, bukan karena banyak elemen.

---

## 1. Ringkasan & 10 aturan inti

**Satu kalimat:** sebuah *editorial workspace* untuk satu orang — kanvas putih, sidebar batu pucat, judul serif, aksi tinta hitam, satu aksen teal gelap untuk state.

**Rasa:** tenang, rapi, seperti halaman majalah yang bisa diklik. Bukan dashboard SaaS, bukan aplikasi mobile, bukan landing page.

### 10 aturan yang tidak boleh dilanggar

| # | Aturan |
|---|--------|
| 1 | **Satu permukaan editorial.** Konten duduk langsung di kanvas putih. Tidak ada kartu di mana-mana. |
| 2 | **Hairline, bukan bayangan.** Struktur dibentuk garis 1px (`--rule` / `--border`). Shadow hanya untuk overlay (modal, off-canvas). |
| 3 | **Serif untuk nama & judul.** Instrument Serif untuk h1, judul item, nama koleksi, isi catatan. Sans untuk seluruh UI. |
| 4 | **Aksen < 2%.** Deep teal hanya untuk state (unread, link, saved, aktif). Bukan untuk dekorasi. |
| 5 | **Tanpa gradien, tanpa chart, tanpa ilustrasi dekoratif.** Ikon Lucide outline saja. |
| 6 | **Angka selalu tabular** (`font-variant-numeric: tabular-nums`), weight 400. |
| 7 | **Tombol berbentuk pill**, tinggi 36px. Kontrol input radius 7–8px. Panel radius 10–14px. |
| 8 | **Satu aksi primer per layar.** Hitam tinta. Sisanya tombol putih bergaris. |
| 9 | **Sentence case, tenang, spesifik.** Tanpa tanda seru, tanpa emoji, tanpa "Welcome back!". |
| 10 | **Motion kecil dan cepat.** 130–220ms, hanya opacity/transform. Hormati `prefers-reduced-motion`. |

---

## 2. Identitas & prinsip desain

### 2.1 Konsep

LinkVault adalah perpustakaan pribadi: bookmark + catatan, disimpan lokal. Metafora visualnya **rak buku dan kertas**, bukan aplikasi database.

- Kanvas putih = kertas.
- Sidebar batu pucat (`#e9ebe6`) = dinding/netral di belakang kertas.
- Garis tipis = garis buku/kolom majalah.
- Serif = judul bab; sans = keterangan.
- Teal = tinta stempel "belum dibaca / tersimpan".

### 2.2 Tiga lapisan warna

1. **Ground** (`#ffffff`) — area konten. Paling terang.
2. **Canvas** (`#e9ebe6`) — sidebar dan body background. Sedikit lebih gelap, hijau-kelabu.
3. **Surface** (`#eff1ec`) — panel tonal (unread panel, welcome, empty state). Satu langkah dari canvas.

Tidak ada lapisan keempat. Jangan membuat "kartu putih di dalam panel abu-abu" — itu pola bento template yang dihindari.

### 2.3 Hierarki visual

```
Judul halaman (serif 34px)
  └ Subtitle (sans 13px, muted)
      └ Section heading (sans 14px/600)
          └ Item title (serif 18.5px)
              └ Excerpt (sans 12.5px, 2 baris)
                  └ Meta (sans 11.5px, faint)
```

Setiap level hanya boleh muncul di dalam level di atasnya. Jangan melompati level (mis. excerpt 15px di dalam baris daftar).

### 2.4 Prinsip komposisi

- **Garis horizontal lebih penting daripada kotak.** Daftar item, tabel, dan panel samping dipisahkan hairline.
- **Ruang kosong adalah fitur.** Padding halaman 40/44px, jarak antar-section 34–38px.
- **Kiri rata, hampir selalu.** Hanya brand di mobile bar yang di tengah.
- **Dua kolom hanya untuk halaman dalam** (overview: 1fr + 268px; detail: 1fr + 292px). Halaman indeks tetap satu kolom.
- **Aksi muncul saat hover** pada baris (opacity 0 → 1). Di layar sentuh/≤960px, aksi selalu terlihat.

---

## 3. Design tokens

Salin apa adanya. Nama token sengaja deskriptif, bukan semantik-abstrak.

### 3.1 Warna

```css
:root {
  /* --- Permukaan --- */
  --ground:        #ffffff;  /* kanvas konten */
  --canvas:        #e9ebe6;  /* sidebar + body */
  --surface:       #eff1ec;  /* panel tonal */
  --surface-strong:#e8e9e3;  /* hover ikon, chip state */
  --border:        #dcded6;  /* batas kontrol / sidebar */
  --rule:          #e8e9e2;  /* hairline daftar & tabel */

  /* --- Teks --- */
  --text:          #20211d;  /* tinta utama */
  --muted:         #67665f;  /* teks sekunder */
  --faint:         #64645c;  /* label mikro, meta */

  /* --- Aksen & status --- */
  --accent:        #1b6e66;  /* deep teal: state, link, saved */
  --accent-soft:   #e2efeb;  /* latar chip/aksen */
  --danger:        #a83026;  /* aksi destruktif */
  --danger-soft:   #fbeae7;  /* latar error */
}
```

Warna tambahan yang dipakai langsung (bukan token global, tapi resmi):

| Keperluan | Nilai | Catatan |
|---|---|---|
| Favorit (bintang) | `#9a6a10` | Emas redup, hanya untuk bintang |
| Ikon bookmark | `#8a7c60` | Cokelat netral |
| Tag pill | bg `#f1eee5`, teks `#57574f` | Netral, bukan aksen |
| `kbd` | bg `#fbfaf6`, border `--border` | |
| Search trigger | bg `#f8f8f3` | |
| Nav aktif | bg `#dfe2d9` | |
| Segmented control | bg `#f1eee6` | |
| Hover baris | `#fafaf6` | |
| Hover panel tonal | `rgba(255,255,255,.55)` | |
| Selection | `#cfe6e1` | |
| Editor Markdown | bg `#fdfcf9` | |
| Focus ring editor | `#a9c4bd` | |
| Code block | bg `#23241f`, teks `#f2efe6` | Satu-satunya area gelap |
| Toast | bg `#20211d`, teks `#fff` | Border kiri 3px sesuai tone |
| Draft banner | bg `#fbf6e7`, teks `#5d4d20` | |
| Error text | `#6f261e` | Di atas `--danger-soft` |
| Scrim | `rgba(24,24,20,.4)` | Modal |
| Scrim sidebar | `rgba(24,24,20,.36)` | |

**Palet tag** (untuk pilihan warna tag, urut):
`#1b6e66`, `#7c5a2e`, `#5b5f97`, `#8a3f4a`, `#3d6b3f`, `#4f5b62`, `#7a4b75`, `#2f5d7c`

### 3.2 Tipografi

```css
--font-sans:  "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
--font-serif: "Instrument Serif", Georgia, serif;
--font-mono:  ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, monospace;
```

Font di-self-host sebagai WOFF2:

| File | Weight | Style |
|---|---|---|
| `instrument-sans.woff2` | 400–600 (variable) | normal |
| `instrument-serif.woff2` | 400 | normal |
| `instrument-serif-italic.woff2` | 400 | italic |

`font-display: swap`. Body default:

```css
body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--canvas);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

Mono **hanya** untuk blok kode dan path file. Tidak untuk angka, label, atau UI.

### 3.3 Spacing

Skala yang dipakai: `0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 36, 38, 40, 44, 46, 48, 52, 56, 96` (px).

Panduan:
- Ikon ↔ label: 7–10px.
- Item baris: padding vertikal 13px, gap 13px.
- Antar section: 34–38px.
- Page header → konten: 26px.
- Form field: margin-bottom 14px.
- Grid kolom besar: 36–56px.

### 3.4 Radius

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--radius` | 10px | panel tonal, editor shell, state |
| `--radius-lg` | 14px | modal, welcome |
| kecil | 4–6px | `kbd`, icon-btn, tag dot container |
| kontrol | 7–8px | input, select, search box, nav item |
| pill | 999px | button, tag, segmented, nav-count |

### 3.5 Shadow & elevation

Hampir tidak ada shadow. Yang diizinkan hanya:

```css
/* modal */
box-shadow: 0 18px 60px rgba(24, 24, 20, 0.22);
/* sidebar off-canvas */
box-shadow: 0 0 40px rgba(0, 0, 0, 0.12);
```

Tidak ada shadow untuk kartu, tombol, atau baris.

### 3.6 Z-index

| Lapisan | z-index |
|---|---|
| Sidebar (desktop) | 30 |
| Scrim sidebar | 20 |
| Mobile bar | 15 |
| Toast stack | 80 |
| Skip link | 100 |
| Modal | native `<dialog>` (top layer) |

### 3.7 Motion

| Nama | Durasi | Easing | Dipakai |
|---|---|---|---|
| page-in | 220ms | ease | masuk halaman (opacity + translateY 4px) |
| micro | 130ms | ease | hover bg/border/color |
| press | 80ms | ease | `translateY(1px)` saat aktif |
| toast-in | 180ms | ease | opacity + translateY 6px |
| shimmer | 1.4s | ease-in-out infinite | skeleton (opacity 1 → .45 → 1) |
| pulse | 1s | ease infinite | titik "saving" |
| sidebar | 200ms | ease | transform off-canvas |

---

## 4. Skala tipografi (lengkap)

| Peran | Font | Size | Weight | Line-height | Tracking | Warna |
|---|---|---|---|---|---|---|
| Page title (h1) | Serif | 34px | 400 | 1.05 | -0.012em | `--text` |
| Page title mobile (≤640) | Serif | 24px | 400 | 1.05 | -0.012em | `--text` |
| Detail title (editable) | Serif | 33px | 400 | 1.1 | -0.012em | `--text` |
| Detail title mobile | Serif | 27px | 400 | 1.1 | — | `--text` |
| Welcome h2 | Serif | 34px | 400 | 1.1 | -0.01em | `--text` |
| State h2 (empty/error) | Serif | 22px | 400 | — | — | `--text` |
| Note invite h2 | Serif | 20px | 400 | — | — | `--text` |
| Collection name | Serif | 20px | 400 | 1.2 | — | `--text` |
| Item title | Serif | 18.5px | 400 | 1.22 | -0.005em | `--text` |
| Brand name | Serif | 23px | 400 | 1 | -0.01em | `--text` |
| Prose editor | Serif | 17.5px | 400 | 1.68 | — | `--text` |
| Prose h1 / h2 / h3 | Serif | 27 / 22 / 19px | 400 | 1.18 | -0.01em | `--text` |
| Description | Sans | 15px | 400 | 1.7 | — | `--text` |
| Section heading (h2) | Sans | 14px | 600 | — | -0.005em | `--text` |
| Body / UI | Sans | 14px | 400 | 1.5 | — | `--text` |
| Nav item | Sans | 13.5px | 400 (500 aktif) | — | — | `#4c4c45` |
| Button label | Sans | 13px | 500 | — | — | `--text` / putih |
| Input value | Sans | 13.5px | 400 | — | — | `--text` |
| Table row | Sans | 13.5px | 400 | — | — | `--text` |
| Page subtitle | Sans | 13px | 400 | — | — | `--muted` |
| Search input (palette) | Sans | 15px | 400 | — | — | `--text` |
| Item excerpt | Sans | 12.5px | 400 | 1.45 | — | `--muted` |
| Search result title | Sans | 13.5px | 500 | — | — | `--text` |
| Search snippet | Sans | 12px | 400 | — | — | `--muted` |
| Link button | Sans | 12.5px | 500 | — | — | `--accent` |
| Detail meta | Sans | 12px | 400 | — | — | `--muted` |
| Sidebar sub | Sans | 11.5px | 400 | — | 0.01em | `--faint` |
| Nav label (group) | Sans | 11.5px | 400 | — | — | `--faint` |
| Item meta | Sans | 11.5px | 400 | — | — | `--faint` |
| Tag | Sans | 11px | 400 | 1.4 | — | `#57574f` |
| State label (Archived) | Sans | 10.5px | 400 | — | — | `--muted` |
| Nav count | Sans | 10.5px | 400 | 1 | — | `--accent` |
| `kbd` | Sans | 10.5px | 400 | 1 | — | `--muted` |
| Shelf label | Sans | 11.5px | 400 | — | — | `--muted` |
| Shelf value | Sans | 21px | 400 | 1 | tabular | `--text` |

Aturan:
- **Jangan pakai uppercase.** Tidak ada `text-transform: uppercase` di mana pun.
- **Letter-spacing negatif hanya untuk serif besar** (≥18px). Jangan untuk sans.
- **Max measure:** paragraf 52–66ch. Jangan biarkan teks selebar layar.
- Angka statistik & count: `font-variant-numeric: tabular-nums`, weight 400.

---

## 5. Layout & grid

### 5.1 App shell (desktop > 960px)

```
┌──────────────┬───────────────────────────────────────────┐
│ sidebar      │ main-wrap                                 │
│ 248px        │ background: --ground                      │
│ sticky, 100vh│ ┌───────────────────────────────────────┐ │
│ canvas bg    │ │ .main max-width 1240px, margin auto   │ │
│ border-right │ │ padding 40px 44px 96px                │ │
│              │ │                                       │ │
│ [brand]      │ │ page content                          │ │
│ [search]     │ │                                       │ │
│ [nav groups] │ │                                       │ │
│ ...          │ │                                       │ │
│ [footer]     │ │                                       │ │
└──────────────┴───────────────────────────────────────────┘
```

```css
.shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--ground);
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 26px 14px 18px;
  background: var(--canvas);
  border-right: 1px solid var(--border);
  z-index: 30;
}
.main-wrap { min-width: 0; background: var(--ground); }
.main { max-width: 1240px; margin: 0 auto; padding: 40px 44px 96px; }
```

### 5.2 Grid halaman

| Halaman | Grid | Gap |
|---|---|---|
| Overview (populated) | `minmax(0,1fr) 268px` | column-gap 52px |
| Detail item | `minmax(0,1fr) 292px` | column-gap 56px |
| List / Tags / Collections / Data | satu kolom | — |

Detail: `.back-link`, `.draft-banner`, dan `.detail-head` membentang penuh (`grid-column: 1 / -1`). Aside sticky `top: 32px`.

### 5.3 Shelf strip (ringkasan angka Overview)

6 kolom sama besar, dipisah hairline vertikal + border atas/bawah. Setiap sel: label 11.5px di atas, angka 21px di bawah. Hover: bg `#fafaf6`, label jadi aksen. Di ≤960px menjadi 3 kolom.

### 5.4 Breakpoint

| Breakpoint | Perubahan |
|---|---|
| **≤1120px** | Detail grid `1fr 260px`, gap 36px |
| **≤960px** | Sidebar jadi off-canvas (fixed 282px, translateX(-102%)); scrim; mobile bar 54px; main padding 26/22/80; detail 1 kolom; aside jadi section di bawah dengan border-top; aksi baris selalu terlihat; overview 1 kolom; shelf strip 3 kolom |
| **≤640px** | Main padding 22/16/72; page-head jadi kolom; h1 24px; detail title 27px; shelf value 18px; collection-updated disembunyikan; editor hint turun baris; modal padding 18px; toast full-width; item title boleh wrap |

### 5.5 Mobile bar

Hanya muncul ≤960px. Tinggi 54px, sticky top, bg `--ground`, border-bottom. Isi: tombol menu (kiri), brand (tengah), tombol search (kanan).

---

## 6. App shell & navigasi

### 6.1 Sidebar — urutan dari atas

1. **Brand row**: mark 22×22 (teal) + wordmark serif 23px. Padding horizontal 8px.
2. **Brand sub**: "A local library", 11.5px, `--faint`, margin `5px 0 22px 38px` (sejajar setelah mark).
3. **Search trigger**: full width, tinggi 37px, radius 8px, bg `#f8f8f3`, border `--border`. Ikon search 15px + "Search everything" + `kbd` shortcut. Hover: border `#c9ccc1`, bg putih.
4. **Nav** (scrollable):
   - Group label: 11.5px `--faint`, padding 0 10px, margin-bottom 5px. Jarak antar group 20px.
   - Item: tinggi 33px, padding 0 10px, radius 7px, gap 10px, 13.5px, warna `#4c4c45`. Ikon 16px stroke 1.7 warna `--faint`.
   - Hover: `rgba(32,33,29,.05)`.
   - Aktif: bg `#dfe2d9`, teks `--text`, weight 500, ikon `--accent`.
   - Count badge (opsional): pill, 10.5px, bg `--accent-soft`, teks `--accent`, tabular.
5. **Footer** (`margin-top: auto`):
   - Primary button "Save a link" (pill hitam, full width, ikon Plus).
   - Secondary "New note" (transparent, border).
   - Link "Import & export" (11.5px, `--muted`, ikon Database 13px).
   - "Stored on this device" (11px, `--faint`, center).

**Struktur nav:**

| Group | Item |
|---|---|
| Library | Overview, All items, Bookmarks, Notes |
| Shelves | Collections, Tags |
| Saved | Favorites, Archive, Trash |

Badge count hanya di Bookmarks (unread) dan Trash.

### 6.2 Shortcut global

| Shortcut | Aksi |
|---|---|
| `Ctrl/Cmd + K` | Buka search palette |
| `Ctrl/Cmd + Shift + B` | Dialog simpan link |
| `Ctrl/Cmd + Shift + N` | Dialog catatan baru |
| `Esc` | Tutup modal |

Tampilkan `⌘` di Mac, `Ctrl` di platform lain (deteksi `navigator.platform`).

### 6.3 Skip link

Selalu ada, tersembunyi di `left: -9999px`, muncul di `left: 8px` saat fokus. Teks "Skip to content", bg `--text`, teks putih, radius 6px.

---

## 7. Komponen

Semua komponen memakai token. Jangan menambahkan varian yang tidak ada.

### 7.1 Button

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 7px;
  height: 36px; padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  font-size: 13px; font-weight: 500;
  white-space: nowrap;
  transition: background 130ms ease, border-color 130ms ease, transform 80ms ease;
}
.btn:hover  { background: #f8f8f3; border-color: #c9ccc1; }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
```

| Varian | Spec |
|---|---|
| Default | putih + border |
| Primary | bg `#20211d`, border sama, teks putih; hover bg `#34352f` |
| Danger | bg `--danger`, teks putih; hover `#8f281f` |

Ikon di dalam tombol: 14–16px, stroke 1.7.

### 7.2 Icon button

30×30px, radius 6px, transparan, ikon 14–17px, warna `--muted`.
Hover: bg `--surface-strong`, teks `--text`.
Varian: `.is-on` (teal), `.is-favorite` (`#9a6a10`), `.danger` (hover bg `--danger-soft`, teks `--danger`).

### 7.3 Link button

Tanpa border/background, padding 0, 12.5px weight 500, warna `--accent`, underline saat hover. Varian `.muted` dan `.danger`.

### 7.4 Input, textarea, select

```css
.input {
  width: 100%; height: 37px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: #fff;
  padding: 0 10px;
  font-size: 13.5px;
  outline: none;
  transition: border-color 130ms ease;
}
.input:focus { border-color: var(--accent); }
```

- Textarea: min-height 90px, padding 9px 10px, resize vertical, line-height 1.55.
- Select: tinggi 34px, radius 7px, padding 0 8px, 12.5px.
- Input kecil (inline tag): tinggi 32px, 12.5px.
- Focus global: `outline: 2px solid var(--accent); outline-offset: 2px;` (untuk elemen non-input).

**Field anatomy:**

```
<label class="field">
  <span>Label <em>optional</em></span>   ← 12px/500 muted; em = 11px faint normal
  <input class="input" />
  <small>Helper text</small>             ← 11.5px faint
</label>
```

### 7.5 Search input (filter bar & palette)

- Filter bar: tinggi 36px, radius 8px, putih, ikon 15px, max-width 360px, flex 1.
- Search palette: tinggi 44px, radius 8px, ikon 18px, input 15px. Focus-within: border `--accent`.
- Tombol clear: ikon X 14px, hover bg `--surface-strong`.

### 7.6 Segmented control

```css
.segmented {
  display: inline-flex; gap: 2px; padding: 3px;
  border-radius: 999px; background: #f1eee6;
}
.segmented button {
  height: 28px; padding: 0 12px;
  border: 0; border-radius: 999px;
  background: transparent; color: var(--muted);
  font-size: 12.5px; font-weight: 500;
}
.segmented button.on { background: #fff; color: var(--text); }
```

Dipakai untuk: filter Read (All/Unread/Read), mode editor (Markdown/Rich text).

### 7.7 Tag pill

- Tinggi mengikuti teks (11px/1.4), padding `1px 7px`, radius 999px.
- bg `#f1eee5`, teks `#57574f`.
- Opsional `tag-dot` 6×6 bulat dengan warna tag.
- Varian `removable`: padding-right 3px, tombol X kecil; hover X → merah.
- Di baris item: maksimal 3 tag + `+N` (11px, faint).

### 7.8 Item row (komponen inti)

```
┌─────────────────────────────────────────────────────────────┐
│ [ikon]  Judul item serif 18.5px            [★] [•] [aksi]  │
│         Excerpt dua baris, 12.5px muted                     │
│         domain · 2d ago · [tag] [tag] [+2]                  │
└─────────────────────────────────────────────────────────────┘
```

- Container: flex, gap 8px, border-bottom `--rule`. Hover bg `#fafaf6`.
- Hit area: padding `13px 2px`, gap 13px.
- Ikon: 19px slot; bookmark pakai favicon 16×16 radius 3px (fallback ikon Bookmark `#8a7c60`); note pakai FileText `--accent`.
- Judul: serif, satu baris, ellipsis. Di ≤640px boleh wrap.
- State inline: bintang favorit (13px, `#9a6a10`), unread dot 6px `--accent`, label "Archived" (10.5px, chip `--surface-strong`).
- Meta dipisah `·`.
- Aksi (opacity 0, muncul saat hover/focus-within): tandai dibaca, favorit; mode archive: restore; mode trash: restore + hapus permanen.
- Mode trash: judul jadi `--muted`.

### 7.9 Section head

Flex baseline, space-between, margin-bottom 10px. Judul 14px/600. Link kanan 12px `--muted` + ikon ArrowUpRight 14px; hover `--accent`.

### 7.10 Tonal panel

`background: var(--surface); border-radius: 10px; padding: 0 18px;`
Item row di dalamnya memakai border `#e6e7e0` dan hover `rgba(255,255,255,.55)`. Baris terakhir tanpa border.

### 7.11 Stat list / collection list / tag cloud / note list (sidebar overview)

Semua berupa daftar hairline, bukan kartu:

- Baris: flex space-between, padding `8px 2px`, border-bottom `--rule`, 12.5–13px.
- Hover: teks jadi `--accent`.
- Count: 11px, `--faint`, tabular.
- Tag cloud: dot 6px berwarna + nama + count.

### 7.12 Table (Tags)

Grid `minmax(0,1fr) 90px 80px`, padding `10px 4px`, gap 12px, border-bottom `--rule`.
Head: 11.5px `--faint`. Row: 13.5px. Hover `#fbfaf6`. Row actions opacity 0 → 1.

### 7.13 Collection row

Grid `minmax(0,1fr) 90px 120px 66px`, gap 16px, padding `14px 4px`, border-bottom.
Nama: serif 20px; deskripsi: 12.5px muted, satu baris ellipsis; count & updated 11.5px faint. Hover: bg `#fafaf6`, nama jadi aksen. Aksi muncul saat hover.

### 7.14 Empty state

Panel tonal radius 10px, padding `34px 30px`, max-width 560px, rata kiri, gap 10px. Ikon Inbox 20px `--faint`. Judul serif 22px. Body 13px/1.55 muted. Aksi opsional (tombol default).

### 7.15 Error state

Sama seperti empty state, ikon AlertCircle, `role="alert"`, tombol "Try again".

### 7.16 Skeleton

Baris: ikon bulat 18px + dua garis (lebar 72% tinggi 14px, lalu 45% tinggi 11px). Warna `#eceee8`, radius 4px, animasi shimmer.

### 7.17 Welcome (empty library)

Panel `--surface`, radius 14px, padding `46px 48px`, max-width 760px.
H2 serif 34px max 16ch. Paragraf 14px/1.65 max 52ch. Dua tombol. Catatan shortcut 12px faint.
Di kanan ada "rak" dekoratif berupa 4 garis horizontal (`.shelf-line`), murni dekoratif (`aria-hidden`).

### 7.18 Modal

Native `<dialog>`.

```css
.modal {
  border: 0; padding: 0;
  border-radius: 14px;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  background: #fff;
  box-shadow: 0 18px 60px rgba(24,24,20,.22);
}
.modal-wide { width: min(700px, calc(100vw - 32px)); }
.modal::backdrop { background: rgba(24,24,20,.4); }
```

- Body padding `22px 24px 24px`, scroll internal.
- Head: judul 15px/600 + close icon-btn (X 17px).
- Foot (opsional): 11px faint, gap 16px, untuk hint keyboard.
- Klik backdrop atau Esc menutup.
- Form actions rata kanan, gap 8px, margin-top 18px.

### 7.19 Toast

Stack fixed kanan bawah (22px), gap 8px, max-width 360px, z-index 80.
Toast: bg `#20211d`, teks putih, 12.5px/1.45, padding `10px 14px`, radius 8px, border-left 3px:
- success → `--accent`
- error → `#e06a5e`
- info → `#b9b3a4`

Auto-dismiss 4200ms. `aria-live="polite"`.

### 7.20 Draft / warning banner

Flex space-between, wrap, padding `10px 13px`, radius 8px, 12.5px.
Default: bg `#fbf6e7`, teks `#5d4d20`. Warning: bg `--danger-soft`, teks `#6f261e`.

### 7.21 Editor catatan

- Mode bar: segmented (Markdown / Rich text) + save state di kanan.
- Save state: dot 6px + teks 11.5px faint. Warna dot: saved = accent, dirty/saving = `#a66f13`, error/stale = danger. Saving berdenyut.
- Rich shell: border, radius 10px, putih; focus-within border `#a9c4bd`.
- Toolbar: bg `#fbfaf6`, border-bottom, padding `6px 8px`, tombol 29×28px radius 5px, separator vertikal 1×18px.
- Prose: padding `24px 28px 30px`, min-height 430px, serif 17.5px/1.68.
- Markdown mode: textarea bg `#fdfcf9`, border, radius 10px, padding `24px 28px`, min-height 470px, sans 14px/1.7.
- Footer editor: 11.5px faint, gap 16px, wrap.
- Rich text mendukung: H1–H3, bold, italic, strike, bullet/ordered/task list, blockquote, code block, table, link, undo/redo.

### 7.22 Search palette

Modal wide. Search box 44px. Hasil: tombol full-width, radius 7px, padding `9px 10px`, gap 10px; hover/selected bg `--surface`.
Setiap hasil: ikon tipe, judul 13.5px/500 satu baris, snippet 12px muted satu baris, label tipe 10.5px faint.
Highlight `mark`: bg `--accent-soft`, radius 2px.
Navigasi panah atas/bawah, Enter membuka. Hint bawah: `↑ ↓` dan `Enter`.
Debounce 180ms.

### 7.23 kbd

```css
kbd {
  font-family: var(--font-sans);
  font-size: 10.5px; line-height: 1;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 2px 4px;
  background: #fbfaf6;
  color: var(--muted);
}
```

### 7.24 Ikon

- Library: **Lucide** (outline).
- Ukuran: 13–18px di UI, 20px di state.
- Stroke: 1.6–1.7.
- Warna mengikuti teks; aksen hanya untuk state aktif.
- Jangan pakai ikon filled, emoji, atau ilustrasi SVG buatan sendiri — kecuali brand mark.

**Brand mark:** bookmark 22×22 dengan lingkaran di dalam, stroke 1.6, warna `--accent`, `fill: none`.

---

## 8. Blueprint halaman

### 8.1 Overview (`/`)

**Populated:**

```
[PageHeader]
  h1 "Your library"
  sub "12 items on the shelf · 6 unread · last saved 13h ago"
  actions: [New note] [Save a link]

[Shelf strip: 6 kolom hairline]
  Bookmarks 8 | Notes 4 | Favorites 2 | Archived 0 | Tags 10 | Trash 0

[Grid 1fr + 268px, gap 52]
  KIRI:
    Section "Unread" + link "All unread ↗"
      → tonal panel berisi ItemRow
    Section "Recently saved" + link "All items ↗"
      → item-list (hairline)
  KANAN:
    "Collections" + "Manage" → daftar + "＋ New collection"
    "Tags" + "All tags" → tag cloud
    "Recently edited" + "Notes" → daftar judul + waktu
```

**Empty (counts.active === 0):** tampilkan Welcome panel saja. Judul: "Everything you mean to come back to." Dua tombol + hint shortcut.

**Loading:** PageHeader + 5 skeleton rows.
**Error:** PageHeader + ErrorState.

### 8.2 List pages (`/items`, `/bookmarks`, `/notes`, `/favorites`, `/archive`, `/trash`)

Satu komponen, konfigurasi per view:

| View | Judul | Filter status | Aksi header |
|---|---|---|---|
| all | All items | active | New note + New bookmark |
| bookmarks | Bookmarks | active, type=bookmark | New bookmark |
| notes | Notes | active, type=note | New note |
| favorites | Favorites | active, favorite=true | — |
| archive | Archive | archived | — |
| trash | Trash | trash | — |

Struktur:
1. PageHeader (judul + "N items" / "N items matching “q”").
2. Active filter banner (jika tag): "Tag: **x**" + Clear.
3. Filter bar: search ("Filter this shelf…"), segmented Read (hanya bookmarks), Sort select (Last edited / Recently saved / Title).
4. Item list ATAU empty/error/loading.
5. Modal konfirmasi hapus permanen untuk Trash.

Search filter debounce 300ms, disimpan di URL (`?q=`). Sort & read juga di URL.

**Copy empty per view:**

| View | Judul kosong | Body |
|---|---|---|
| all | The shelf is empty | Save a link or start a note. Everything you add stays on this device. |
| bookmarks | No bookmarks yet | Paste a URL and LinkVault will fetch the page title, description and favicon. |
| notes | No notes yet | Notes are written in Markdown and can switch to rich text at any time. |
| favorites | Nothing starred yet | Star the links and notes you want to keep within reach. |
| archive | The archive is empty | Archived items are out of the way but still searchable. |
| trash | Trash is empty | Deleted items wait here until you restore them or delete them forever. |

Jika ada query dan kosong: "No matches on this shelf" + tombol "Clear the filter".

### 8.3 Detail item (`/items/:id`)

```
[Back link] ← Bookmarks / Notes

[Opsional banner Trash]

[Grid 1fr + 292px, gap 56]
  HEADER (full width):
    kiri:  "Bookmark" / "Note" (11.5px faint)
           judul editable serif 33px (textarea auto-size)
           meta: situs · Saved date · Read/Unread
                 ATAU words · Edited x · Markdown/Rich text
    kanan: [Open link] [★] [✓] [Archive] [Trash]

  BODY:
    Bookmark → "Description" + Edit details, Relationships, note invite
    Note     → NoteEditor

  ASIDE (sticky top 32):
    Details (dl hairline: Site/URL/Last opened atau Format/Words, Created, Updated)
    Tags (pill removable + inline add dengan datalist)
    Collections (checklist)
    Relationships (khusus note): search + linked list
    Linked from (backlinks)
```

Detail judul:
- Textarea 1 baris, `field-sizing: content`, border-bottom transparan.
- Hover: border-bottom `--rule`. Focus: `--accent`.
- Enter menyimpan (blur), Esc membatalkan.
- Judul kosong ditolak; kembali ke nilai lama.

Note invite (jika bookmark belum punya catatan tertaut):
- Border-top, judul serif 20px "Thinking about this link?"
- Body muted, tombol "Write a note about this link".
- Aksi: buat note berjudul "Notes on {title}", isi `# {title}\n\n`, lalu tautkan.

### 8.4 Collections (`/collections`)

PageHeader + tombol "New collection". Daftar collection-row. Empty state: "No collections yet" + tombol "Create the first one", body "A collection is a shelf inside the shelf: a project, a trip, a reading list."

Modal create/edit: Name (required, max 120), Description (opsional, 3 baris). Delete confirm menjelaskan item tetap aman.

### 8.5 Collection detail (`/collections/:id`)

Back link → Collections. Page header: nama (serif 34), sub "{deskripsi} · N items". Aksi: Edit (default), Add items (primary), delete icon (danger).

Body: item-list dengan extra action "remove from collection" (X).
Empty: "This collection is empty" + "Add the first item".
Add items: modal wide, search box, checkbox list, tombol "Add N items".

### 8.6 Tags (`/tags`)

PageHeader ("Tags", "N tags across the library").
Form create: input nama (max 60) + color field + tombol "Add tag".
Table: Tag (dot + nama link) | Items | actions (edit, delete).
Edit modal: Name + Colour.
Delete confirm: "“x” will be removed from N items. The items themselves stay in the library."

### 8.7 Import & export (`/data`)

Max-width 860px. Empat blok, tiap blok grid `1fr auto` dengan border-top, padding `22px 0`:

1. **Export the library** → tombol "Export JSON" (download).
2. **Import an export** → file field + tombol Import. Setelah sukses: "Imported N items; skipped N…".
3. **Back up the database** → tombol "Back up now" + path hasil.
4. **Where the data lives** (quiet, border-bottom) → path database & backup, rata kanan.

Copy menekankan: import bersifat merge, tidak menghapus.

### 8.8 404

EmptyState: "This page is not on the shelf" / "The address does not match a screen in LinkVault."

---

## 9. Copy & voice

### 9.1 Karakter suara

- Tenang, dewasa, spesifik. Seperti pustakawan yang membantu, bukan sales.
- Sentence case. Tanpa tanda seru.
- "You" untuk pengguna; hindari "we" berlebihan.
- Sebut hal konkret: "12 items on the shelf", bukan "Your content hub".
- Jangan pakai jargon SaaS: "workspace", "dashboard", "seamless", "supercharge".
- Jangan pakai emoji.

### 9.2 Pola kalimat

| Konteks | Pola | Contoh |
|---|---|---|
| Judul halaman | Kata benda singkat | "Your library", "All items", "Collections" |
| Subtitle | Fakta + angka | "12 items on the shelf · 6 unread · last saved 13h ago" |
| Empty state | Judul pendek + satu kalimat penjelas | "Nothing waiting" / "Every saved bookmark has been read." |
| Error | Apa yang gagal, tanpa menyalahkan | "Could not save the note" |
| Konfirmasi destruktif | Sebut akibat + "cannot be undone" | "“x” will be removed from this device. This cannot be undone." |
| Tombol | Verb + objek | "Save a link", "Add tag", "Delete forever" |
| Loading | Verb + ellipsis | "Saving…", "Searching…", "Reading the shelf…" |

### 9.3 Label baku

Gunakan persis: `Save a link`, `New note`, `All items`, `Import & export`, `Back up now`, `Delete forever`, `Move to Trash`, `Try again`, `Clear the filter`, `Add items`, `Stored on this device`.

---

## 10. State & interaction patterns

### 10.1 Empat state wajib untuk setiap data view

1. **Loading** — skeleton, bukan spinner. `aria-busy="true"`.
2. **Error** — panel dengan pesan + "Try again".
3. **Empty** — panel dengan judul + penjelasan + aksi.
4. **Loaded** — konten.

Jangan pernah menampilkan layar kosong tanpa penjelasan.

### 10.2 Aksi & feedback

- Semua aksi async menampilkan toast sukses/gagal.
- Tombol yang sedang bekerja berubah label: "Saving…", "Deleting…", "Importing…", dan disabled.
- Aksi destruktif **selalu** lewat modal konfirmasi.
- Hapus permanen hanya untuk item yang sudah di Trash (ditegakkan juga oleh API).

### 10.3 Autosave catatan

- Debounce **700ms** setelah berhenti mengetik.
- Indikator selalu terlihat: Saved / Unsaved changes / Saving… / Not saved / Changed elsewhere.
- Jika API gagal: teks disimpan ke `localStorage` (`linkvault:draft:{id}`) dan ditawarkan saat kunjungan berikutnya ("Restore it" / "Discard").
- Konflik tulis (stale): banner "This note changed elsewhere…" + "Load the latest version". Jangan menimpa diam-diam.
- Markdown adalah bentuk kanonik. Edit rich text dikonversi ke Markdown saat simpan.

### 10.4 Pencarian

- Global (Ctrl/Cmd+K): debounce 180ms, cari judul, URL, deskripsi, tag, koleksi, isi catatan.
- Lokal (filter bar): debounce 300ms, hanya di view aktif, disimpan di URL.
- Highlight hasil dengan `mark`.

### 10.5 Hover reveal

Aksi baris (`item-actions`, `row-actions`, `collection-actions`) opacity 0 → 1 pada hover/focus-within. Selalu terlihat di ≤960px dan untuk perangkat sentuh.

### 10.6 Form

- Label di atas field, helper text di bawah.
- Tombol submit di kanan, Cancel di kirinya.
- Error form: panel `--danger-soft`, teks `#6f261e`, `role="alert"`.
- Enter submit; Esc tutup modal.

---

## 11. Aksesibilitas

Wajib:

- **Focus visible:** `outline: 2px solid var(--accent); outline-offset: 2px;` Jangan `outline: none` tanpa pengganti.
- **Skip link** ke `#main`.
- **Landmark:** `<nav aria-label>`, `<main id="main">`, `<aside>`, `<header>`.
- **Semua icon-only button** punya `aria-label` + `title`.
- **State aktif nav** memakai `aria-current` (via NavLink) dan warna, bukan hanya warna.
- **Dialog** memakai `<dialog>` native + `showModal()` (focus trap & Esc gratis).
- **Toast** `aria-live="polite"`; error `role="alert"`.
- **Skeleton** `aria-busy="true"` + `aria-label="Loading"`.
- **Gambar favicon** `alt=""`, `loading="lazy"`, `referrerPolicy="no-referrer"`.
- **Kontras:** body `#67665f` di atas putih ≈ 5.1:1 (lolos AA). Jangan menurunkan `--muted`/`--faint` lebih jauh.
- **Target sentuh** minimal 30×30px untuk ikon, 36px untuk tombol.
- **`prefers-reduced-motion`**: matikan animasi & transisi (durasi 0.001ms), hapus page-in.

---

## 12. Responsif — ringkasan perilaku

| Elemen | Desktop | ≤960 | ≤640 |
|---|---|---|---|
| Sidebar | 248px sticky | off-canvas 282px + scrim | sama |
| Mobile bar | — | 54px sticky | sama |
| Main padding | 40/44/96 | 26/22/80 | 22/16/72 |
| Page head | row | row | column |
| h1 | 34 | 34 | 24 |
| Detail | 2 kolom | 1 kolom, aside di bawah | 1 kolom |
| Overview | 2 kolom | 1 kolom | 1 kolom |
| Shelf strip | 6 kolom | 3 kolom | 3 kolom |
| Item actions | hover | selalu tampil | selalu tampil |
| Item title | ellipsis 1 baris | ellipsis | wrap |
| Toast | kanan bawah 360px | sama | full width 16px |
| Modal | 560/700px | sama | calc(100vw - 32px), padding 18px |

---

## 13. Motion — aturan

- Hanya `opacity` dan `transform`. Jangan animasikan layout (width/height/top/left) kecuali off-canvas.
- Durasi: 80ms (press), 130ms (hover), 180ms (toast), 200ms (sidebar), 220ms (page).
- Tidak ada parallax, bounce, spring, atau animasi masuk per-kartu.
- `prefers-reduced-motion: reduce` → semua durasi 0.001ms, animasi halaman dimatikan.

---

## 14. Do / Don't

### Do
- Pakai hairline untuk memisahkan.
- Pakai serif untuk nama dan judul; sans untuk kontrol.
- Pertahankan satu aksi primer per layar.
- Biarkan ruang kosong besar.
- Tulis copy pendek dan konkret.
- Gunakan panel tonal (bukan kartu putih ber-shadow) untuk mengelompokkan.
- Tampilkan state kosong yang menjelaskan dan menawarkan aksi.

### Don't
- ❌ Kartu di mana-mana, apalagi kartu di dalam kartu.
- ❌ Gradient, glassmorphism, blur, glow.
- ❌ Shadow pada kartu/tombol.
- ❌ Warna aksen untuk dekorasi atau teks panjang.
- ❌ Chart, ilustrasi, emoji, atau ikon filled.
- ❌ Uppercase, letter-spacing lebar, atau label mikro bergaya "eyebrow".
- ❌ Dashboard KPI besar-besar dengan angka tebal.
- ❌ Lebih dari 2 font (serif + sans; mono hanya kode).
- ❌ Animasi berlebihan atau loading spinner.
- ❌ Copy marketing ("supercharge", "seamless", "welcome back!").
- ❌ Sidebar putih dengan border tebal; sidebar harus menyatu dengan kanvas.
- ❌ Kolom konten sempit (624–864px) di desktop.

---

## 15. CSS starter portabel

Salin blok ini ke proyek baru. Cukup ini + font untuk mendapatkan fondasi visual yang sama.

```css
/* fonts */
@font-face { font-family: "Instrument Sans"; src: url("/fonts/instrument-sans.woff2") format("woff2"); font-weight: 400 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Instrument Serif"; src: url("/fonts/instrument-serif.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Instrument Serif"; src: url("/fonts/instrument-serif-italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: swap; }

:root {
  --ground:#ffffff; --canvas:#e9ebe6; --surface:#eff1ec; --surface-strong:#e8e9e3;
  --border:#dcded6; --rule:#e8e9e2;
  --text:#20211d; --muted:#67665f; --faint:#64645c;
  --accent:#1b6e66; --accent-soft:#e2efeb;
  --danger:#a83026; --danger-soft:#fbeae7;
  --radius:10px; --radius-lg:14px;
  --font-sans:"Instrument Sans","Helvetica Neue",Arial,sans-serif;
  --font-serif:"Instrument Serif",Georgia,serif;
  --font-mono:ui-monospace,"SFMono-Regular","Cascadia Mono",Menlo,monospace;
  color-scheme: light;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px; line-height: 1.5;
  color: var(--text); background: var(--canvas);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
h1,h2,h3,p,dl,dd,ul,ol { margin: 0; }
ul,ol { padding: 0; list-style: none; }
::selection { background: #cfe6e1; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.serif { font-family: var(--font-serif); font-weight: 400; }
.tnum { font-variant-numeric: tabular-nums; }

/* shell */
.shell { display: grid; grid-template-columns: 248px minmax(0,1fr); min-height: 100vh; background: var(--ground); }
.sidebar { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 26px 14px 18px; background: var(--canvas); border-right: 1px solid var(--border); }
.main { max-width: 1240px; margin: 0 auto; padding: 40px 44px 96px; }

/* page head */
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 26px; }
.page-head h1 { font-family: var(--font-serif); font-weight: 400; font-size: 34px; line-height: 1.05; letter-spacing: -.012em; }
.page-sub { margin-top: 8px; font-size: 13px; color: var(--muted); }

/* button */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:36px; padding:0 14px; border:1px solid var(--border); border-radius:999px; background:#fff; font-size:13px; font-weight:500; white-space:nowrap; transition: background 130ms ease, border-color 130ms ease, transform 80ms ease; }
.btn:hover { background:#f8f8f3; border-color:#c9ccc1; }
.btn:active { transform: translateY(1px); }
.btn-primary { background:#20211d; border-color:#20211d; color:#fff; }
.btn-primary:hover { background:#34352f; border-color:#34352f; }
.btn-danger { background:var(--danger); border-color:var(--danger); color:#fff; }

/* input */
.input { width:100%; height:37px; border:1px solid var(--border); border-radius:7px; background:#fff; padding:0 10px; font-size:13.5px; outline:none; transition:border-color 130ms ease; }
.input:focus { border-color: var(--accent); }

/* hairline list */
.rule-list > * { border-bottom: 1px solid var(--rule); }

@media (max-width: 960px) {
  .shell { display: block; }
  .main { padding: 26px 22px 80px; }
}
@media (max-width: 640px) {
  .main { padding: 22px 16px 72px; }
  .page-head { flex-direction: column; gap: 14px; }
  .page-head h1 { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
}
```

---

## 16. Pemetaan Tailwind v4 (opsional)

Proyek asli mengimpor `tailwindcss` tetapi mayoritas styling berupa kelas CSS tulisan tangan. Jika ingin memakai utility, definisikan theme agar nama token konsisten:

```css
@import "tailwindcss";

@theme {
  --color-ground: #ffffff;
  --color-canvas: #e9ebe6;
  --color-surface: #eff1ec;
  --color-surface-strong: #e8e9e3;
  --color-border-soft: #dcded6;
  --color-rule: #e8e9e2;
  --color-ink: #20211d;
  --color-muted: #67665f;
  --color-faint: #64645c;
  --color-accent: #1b6e66;
  --color-accent-soft: #e2efeb;
  --color-danger: #a83026;
  --color-danger-soft: #fbeae7;

  --font-sans: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Instrument Serif", Georgia, serif;

  --radius-panel: 10px;
  --radius-dialog: 14px;
}
```

Kelas yang setara: `bg-ground`, `bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `text-faint`, `border-border-soft`, `font-serif`, `rounded-panel`.

Catatan: jangan membuat kelas `shadow-*` untuk kartu. Elevasi hanya untuk overlay.

---

## 17. Checklist implementasi untuk AI

Sebelum menyatakan selesai, pastikan:

- [ ] `:root` berisi seluruh token dari Bagian 3, tanpa warna tambahan.
- [ ] Font self-hosted; body 14px/1.5; sans untuk UI, serif untuk judul.
- [ ] Shell: sidebar 248px + main max 1240px/padding 40 44 96.
- [ ] Page header: h1 serif 34px + subtitle 13px muted + aksi kanan.
- [ ] Hanya satu tombol primary (hitam) per layar.
- [ ] Semua pemisah memakai hairline; tidak ada shadow kartu.
- [ ] Tidak ada gradient, chart, emoji, uppercase, atau ikon filled.
- [ ] Item row: ikon + judul serif + excerpt 2 baris + meta + tag (maks 3) + aksi hover.
- [ ] Setiap data view punya state loading (skeleton), error, empty, loaded.
- [ ] Aksi destruktif memakai modal konfirmasi.
- [ ] Toast untuk feedback async; `aria-live`.
- [ ] Focus ring terlihat; skip link ada; ikon-button punya `aria-label`.
- [ ] Breakpoint 1120 / 960 / 640 diterapkan; sidebar off-canvas di ≤960.
- [ ] `prefers-reduced-motion` dihormati.
- [ ] Copy sentence case, tanpa tanda seru/emoji.
- [ ] Angka memakai `tabular-nums`.

### Prompt ringkas (jika ingin memakai dokumen ini di AI lain)

> Bangun UI dengan sistem **LinkVault**: kanvas putih `#ffffff`, body/sidebar `#e9ebe6`, panel tonal `#eff1ec`, hairline `#e8e9e2`, tinta `#20211d`, muted `#67665f`, satu aksen teal `#1b6e66` (maks 2% area), danger `#a83026`. Font Instrument Serif (judul/nama) + Instrument Sans (UI), body 14px/1.5. Sidebar 248px sticky, konten max 1240px padding 40/44/96. Tombol pill 36px, input radius 7px, panel radius 10px, modal 14px. Struktur dibentuk hairline, bukan shadow/kartu. Serif 34px untuk h1, 18.5px untuk judul item; sans 13–14px untuk UI; meta 11–12px. Tanpa gradient, chart, emoji, uppercase, atau ikon filled. Satu aksi primer hitam per layar. State wajib: skeleton, empty, error, loaded; toast untuk feedback; modal untuk aksi destruktif. Copy tenang, sentence case, konkret. Hormati `prefers-reduced-motion`.

---

**Selesai.** Jika ada keputusan desain yang tidak tercakup, pilih opsi yang **lebih sedikit** (lebih sedikit warna, lebih sedikit border, lebih sedikit gerakan) dan tetap di dalam token di atas.
