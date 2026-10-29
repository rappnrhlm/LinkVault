import type { FastifyInstance } from 'fastify';
import { listItems, searchItems, getItem } from '../repo.js';
import { createBookmark, createNote, permanentlyDelete, updateItem } from '../services/items.js';

interface ExtensionPayload {
  command: string;
  args?: string[];
  body?: string;
  senderId?: string;
  isGroup?: boolean;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export default async function rapbotRoutes(app: FastifyInstance) {
  const db = app.db;

  app.post('/command', async (request, reply) => {
    const payload = request.body as ExtensionPayload;
    const args = Array.isArray(payload.args) ? [...payload.args] : [];
    const resource = (args.shift() || 'help').toLowerCase();

    try {
      // -------------------------------------------------------------
      // 1. HELP MENU (RINGKAS & TO THE POINT)
      // -------------------------------------------------------------
      if (resource === 'help' || resource === 'bantuan') {
        const helpText =
          `📖 *PANDUAN LINKVAULT*\n\n` +
          `*SEMUA ITEM*\n` +
          `!lv list ➔ Lihat semua link & catatan\n\n` +
          `*LINK / BOOKMARK*\n` +
          `!lv link add <url> ➔ Simpan link\n` +
          `!lv link list ➔ Lihat daftar link\n` +
          `!lv link detail ➔ Info lengkap & ID link\n` +
          `!lv link del <id> ➔ Hapus link\n\n` +
          `*CATATAN / MEMO*\n` +
          `!lv note add <judul> | <isi> ➔ Buat catatan\n` +
          `!lv note list ➔ Lihat daftar catatan\n` +
          `!lv note detail ➔ Isi lengkap & ID catatan\n` +
          `!lv note del <id> ➔ Hapus catatan\n\n` +
          `*CARI*\n` +
          `!lv cari <kata kunci> ➔ Cari link & catatan`;
        return { text: helpText };
      }

      // -------------------------------------------------------------
      // 1B. LIHAT SEMUA ITEM (!lv list / !lv all)
      // -------------------------------------------------------------
      if (resource === 'list' || resource === 'all') {
        const limit = Math.min(Math.max(parseInt(args[0] || '10', 10) || 10, 1), 25);
        const { items, total } = listItems(db, {
          status: 'active',
          sort: 'created',
          limit,
          offset: 0
        });

        if (items.length === 0) {
          return { text: '📭 Belum ada item tersimpan di LinkVault.' };
        }

        let response = `🗂️ *SEMUA ITEM LINKVAULT* (${items.length}/${total})\n\n`;
        items.forEach((item, index) => {
          const isBm = item.type === 'bookmark';
          const typeBadge = isBm ? '[LINK]' : '[NOTE]';
          const shortId = item.id.slice(0, 8);
          response += `${index + 1}. ${typeBadge} *${item.title || 'Untitled'}* [\`${shortId}\`]\n`;
          if (isBm && item.bookmark?.url) {
            response += `   ${item.bookmark.url}\n`;
          } else if (!isBm && item.note?.contentMd) {
            const preview = item.note.contentMd.trim().replace(/\n/g, ' ');
            response += `   ${preview.length > 60 ? preview.slice(0, 60) + '...' : preview}\n`;
          }
          response += `\n`;
        });
        response += `_Hapus: \`!lv link del <id>\` atau \`!lv note del <id>\`_`;
        return { text: response.trim() };
      }

      // -------------------------------------------------------------
      // 2. RESOURCE: LINK (!lv link ...)
      // -------------------------------------------------------------
      if (resource === 'link' || resource === 'links') {
        const action = (args.shift() || 'list').toLowerCase();

        switch (action) {
          case 'add':
          case 'save':
          case 'simpan': {
            if (args.length === 0) {
              return { text: '⚠️ Masukkan link yang mau disimpan.\nContoh: `!lv link add https://github.com`' };
            }

            const rawUrl = args[0]!;
            const tagPart = args.slice(1).join(' ').trim();
            const tags = tagPart ? tagPart.split(',').map(t => t.trim()).filter(Boolean) : undefined;

            try {
              const { item, warning } = await createBookmark(db, { url: rawUrl, tags });
              let response = `✅ *Link Berhasil Disimpan!*\n\n`;
              response += `📌 *Judul:* ${item.title || '(Tanpa judul)'}\n`;
              response += `🆔 *ID:* \`${item.id.slice(0, 8)}\`\n`;
              if (item.bookmark?.url) response += `🔗 *URL:* ${item.bookmark.url}\n`;
              if (item.tags?.length) response += `🏷️ *Tag:* ${item.tags.map(t => '#' + t.name).join(' ')}\n`;
              if (warning) response += `\n⚠️ _Catatan: ${warning}_`;
              return { text: response.trim() };
            } catch (err: any) {
              return { text: `❌ Gagal menyimpan link: ${err?.message || 'Error'}` };
            }
          }

          case 'list': {
            const limit = Math.min(Math.max(parseInt(args[0] || '5', 10) || 5, 1), 15);
            const { items, total } = listItems(db, {
              type: 'bookmark',
              status: 'active',
              sort: 'created',
              limit,
              offset: 0
            });

            if (items.length === 0) {
              return { text: '📭 Belum ada link yang tersimpan.' };
            }

            let response = `📌 *DAFTAR LINK* (${items.length}/${total})\n\n`;
            items.forEach((item, index) => {
              const shortId = item.id.slice(0, 8);
              response += `${index + 1}. *${item.title || 'Untitled'}* [\`${shortId}\`]\n`;
              if (item.bookmark?.url) response += `   ${item.bookmark.url}\n\n`;
            });
            response += `_Ketik \`!lv link detail\` untuk info lengkap atau \`!lv link del <id>\`_`;
            return { text: response.trim() };
          }

          case 'detail': {
            const limit = Math.min(Math.max(parseInt(args[0] || '5', 10) || 5, 1), 15);
            const { items, total } = listItems(db, {
              type: 'bookmark',
              status: 'active',
              sort: 'created',
              limit,
              offset: 0
            });

            if (items.length === 0) {
              return { text: '📭 Belum ada link yang tersimpan.' };
            }

            let response = `📌 *DETAIL LINK* (${items.length}/${total})\n\n`;
            items.forEach((item, index) => {
              response += `*${index + 1}. ${item.title || 'Untitled'}*\n`;
              response += `   ID: \`${item.id}\`\n`;
              if (item.bookmark?.url) response += `   URL: ${item.bookmark.url}\n`;
              if (item.bookmark?.siteName) response += `   Situs: ${item.bookmark.siteName}\n`;
              if (item.tags?.length) response += `   Tag: ${item.tags.map(t => '#' + t.name).join(' ')}\n`;
              response += `   Dibuat: ${formatDate(item.createdAt)}\n\n`;
            });
            response += `_Hapus link: \`!lv link del <id>\`_`;
            return { text: response.trim() };
          }

          case 'del':
          case 'delete':
          case 'hapus': {
            const targetId = (args[0] || '').trim();
            return await deleteVaultItem(db, targetId, 'bookmark');
          }

          default:
            return { text: `Aksi tidak dikenal. Gunakan: \`add\`, \`list\`, \`detail\`, atau \`del\`.\nContoh: \`!lv link list\`` };
        }
      }

      // -------------------------------------------------------------
      // 3. RESOURCE: NOTE (!lv note ...)
      // -------------------------------------------------------------
      if (resource === 'note' || resource === 'notes') {
        const action = (args.shift() || 'list').toLowerCase();

        switch (action) {
          case 'add':
          case 'catat':
          case 'tulis': {
            const rawText = args.join(' ').trim();
            if (!rawText) {
              return {
                text: '⚠️ Masukkan isi catatan.\nContoh:\n• `!lv note add Ide Baru | Bikin bot pengingat tugas`\n• `!lv note add Beli susu di warung`'
              };
            }

            let title: string | undefined = undefined;
            let contentMd = rawText;

            // Pemisah tanda | untuk judul & isi
            if (rawText.includes('|')) {
              const parts = rawText.split('|');
              title = parts[0]?.trim();
              contentMd = parts.slice(1).join('|').trim();
            }

            try {
              const item = createNote(db, { title, contentMd });
              let response = `✅ *Catatan Disimpan!*\n\n`;
              response += `📌 *Judul:* ${item.title || 'Untitled note'}\n`;
              response += `🆔 *ID:* \`${item.id.slice(0, 8)}\`\n`;
              response += `📄 *Isi:* ${item.note?.contentMd || contentMd}\n`;
              response += `🕒 *Dibuat:* ${formatDate(item.createdAt)}`;
              return { text: response.trim() };
            } catch (err: any) {
              return { text: `❌ Gagal membuat catatan: ${err?.message || 'Error'}` };
            }
          }

          case 'list': {
            const limit = Math.min(Math.max(parseInt(args[0] || '5', 10) || 5, 1), 15);
            const { items, total } = listItems(db, {
              type: 'note',
              status: 'active',
              sort: 'created',
              limit,
              offset: 0
            });

            if (items.length === 0) {
              return { text: '📭 Belum ada catatan yang tersimpan.' };
            }

            let response = `📝 *DAFTAR CATATAN* (${items.length}/${total})\n\n`;
            items.forEach((item, index) => {
              const shortId = item.id.slice(0, 8);
              const content = item.note?.contentMd?.trim() || 'Kosong';
              const preview = content.length > 50 ? content.slice(0, 50) + '...' : content;
              response += `${index + 1}. *${item.title || 'Untitled'}* [\`${shortId}\`]\n`;
              response += `   ${preview.replace(/\n/g, ' ')}\n\n`;
            });
            response += `_Ketik \`!lv note detail\` untuk isi lengkap atau \`!lv note del <id>\`_`;
            return { text: response.trim() };
          }

          case 'detail': {
            const limit = Math.min(Math.max(parseInt(args[0] || '5', 10) || 5, 1), 15);
            const { items, total } = listItems(db, {
              type: 'note',
              status: 'active',
              sort: 'created',
              limit,
              offset: 0
            });

            if (items.length === 0) {
              return { text: '📭 Belum ada catatan yang tersimpan.' };
            }

            let response = `📝 *DETAIL CATATAN* (${items.length}/${total})\n\n`;
            items.forEach((item, index) => {
              response += `*${index + 1}. ${item.title || 'Untitled'}*\n`;
              response += `   ID: \`${item.id}\`\n`;
              response += `   Isi: ${item.note?.contentMd || '-'}\n`;
              response += `   Dibuat: ${formatDate(item.createdAt)}\n\n`;
            });
            response += `_Hapus catatan: \`!lv note del <id>\`_`;
            return { text: response.trim() };
          }

          case 'del':
          case 'delete':
          case 'hapus': {
            const targetId = (args[0] || '').trim();
            return await deleteVaultItem(db, targetId, 'note');
          }

          default:
            return { text: `Aksi tidak dikenal. Gunakan: \`add\`, \`list\`, \`detail\`, atau \`del\`.\nContoh: \`!lv note list\`` };
        }
      }

      // -------------------------------------------------------------
      // 4. GLOBAL SEARCH (!lv cari <keyword>)
      // -------------------------------------------------------------
      if (resource === 'cari' || resource === 'search' || resource === 'find') {
        const query = args.join(' ').trim();
        if (!query) {
          return { text: '⚠️ Masukkan kata kunci pencarian.\nContoh: `!lv cari github`' };
        }

        const results = searchItems(db, query, 5);
        if (results.length === 0) {
          return { text: `🔍 Tidak ada hasil untuk: "*${query}*"` };
        }

        let response = `🔍 *HASIL PENCARIAN:* "*${query}*"\n\n`;
        results.forEach((res, index) => {
          const isBm = res.item.type === 'bookmark';
          const badge = isBm ? '[LINK]' : '[NOTE]';
          response += `${index + 1}. ${badge} *${res.item.title || 'Untitled'}*\n`;
          response += `   ID: \`${res.item.id.slice(0, 8)}\`\n`;
          if (isBm && res.item.bookmark?.url) response += `   ${res.item.bookmark.url}\n`;
          if (res.snippet) response += `   _${res.snippet.replace(/<\/?mark>/g, '*')}_\n`;
          response += `\n`;
        });
        response += `_Hapus: \`!lv link del <id>\` atau \`!lv note del <id>\`_`;
        return { text: response.trim() };
      }

      // Fallback
      return {
        text: `Perintah \`!lv ${resource}\` tidak dikenal.\nKetik \`!lv help\` untuk melihat panduan ringkas.`
      };
    } catch (err: any) {
      return { text: `❌ Terjadi kesalahan pada server LinkVault: ${err.message}` };
    }
  });
}

/**
 * Helper to delete item by UUID or prefix matching
 */
async function deleteVaultItem(db: any, inputId: string, expectedType?: 'bookmark' | 'note') {
  if (!inputId) {
    return {
      text: `⚠️ Masukkan ID yang mau dihapus.\nContoh: \`!lv ${expectedType || 'link'} del b9e9b864\``
    };
  }

  let targetItem = getItem(db, inputId);
  if (!targetItem) {
    const matches = db.prepare('SELECT id FROM items WHERE id LIKE ? and deleted_at IS NULL LIMIT 2').all(`${inputId}%`) as { id: string }[];
    if (matches.length === 1 && matches[0]) {
      targetItem = getItem(db, matches[0].id);
    } else if (matches.length > 1) {
      return { text: `⚠️ ID "${inputId}" ada beberapa yang cocok. Ketik ID lebih panjang.` };
    }
  }

  if (!targetItem) {
    return { text: `❌ Item dengan ID "${inputId}" tidak ditemukan.` };
  }

  try {
    updateItem(db, targetItem.id, { deleted: true });
    permanentlyDelete(db, targetItem.id);

    const typeName = targetItem.type === 'bookmark' ? 'Link' : 'Catatan';
    return {
      text: `🗑️ *${typeName} Berhasil Dihapus!*\n\n📌 *Judul:* ${targetItem.title || 'Untitled'}`
    };
  } catch (err: any) {
    return { text: `❌ Gagal menghapus: ${err?.message || 'Error'}` };
  }
}
