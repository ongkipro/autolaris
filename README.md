<div align="center">

# 🚚 AutoLaris H2H API

### Dokumentasi integrasi partner — **Ongkir · Resi · Tracking · Cancel · Payment Gateway**

Panduan lengkap untuk mengintegrasikan layanan AutoLaris H2H: cek ongkir, buat resi, lacak kiriman, batalkan resi, dan **payment gateway** (Virtual Account · QRIS · E-Wallet DANA) beserta alur callback.

<br/>

![Status](https://img.shields.io/badge/status-stable-22c55e?style=for-the-badge)
![Type](https://img.shields.io/badge/type-API%20Docs-3b82f6?style=for-the-badge)
![Auth](https://img.shields.io/badge/auth-Bearer%20Token-f59e0b?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-0ea5e9?style=for-the-badge)
![Made in](https://img.shields.io/badge/made%20in-Indonesia%20%F0%9F%87%AE%F0%9F%87%A9-e11d48?style=for-the-badge)

![Endpoints](https://img.shields.io/badge/endpoints-5-8b5cf6?style=flat-square)
![Kurir](https://img.shields.io/badge/kurir-8%2B-16a34a?style=flat-square)
![QRIS](https://img.shields.io/badge/QRIS-✓-111?style=flat-square)
![Virtual Account](https://img.shields.io/badge/Virtual%20Account-8%20bank-2563eb?style=flat-square)
![DANA](https://img.shields.io/badge/E--Wallet-DANA-118EEA?style=flat-square)

</div>

---

> [!NOTE]
> Dokumentasi integrasi partner untuk **AutoLaris H2H API**.

## 📚 Dokumentasi

| Dokumen | Cakupan |
|---|---|
| 📘 **[AutoLaris-H2H-API.md](./AutoLaris-H2H-API.md)** | **Referensi lengkap 5 endpoint** — Ongkir, Resi, Tracking, Cancel, Payment |
| 💳 **[AutoLaris-Payment-Gateway-API.md](./AutoLaris-Payment-Gateway-API.md)** | Fokus **payment gateway** — callback, handler Node/PHP, error-handling, go-live |

## 🧩 Daftar Endpoint

| # | Service | Method | Endpoint |
|---|---|---|---|
| 1 | Cek Ongkir | `POST` | `/api/h2h/ongkir` |
| 2 | Create Resi | `POST` | `/api/h2h/order` |
| 3 | Tracking | `POST` | `/api/h2h/lacak` |
| 4 | Cancel Resi | `POST` | `/api/h2h/cancel` |
| 5 | Create Payment | `POST` | `/api/h2h/create_payment` |

## 📑 Daftar Isi

- [Sekilas](#-sekilas)
- [Alur Integrasi](#-alur-integrasi)
- [Quick Start](#-quick-start)
- [Channel Pembayaran](#-channel-pembayaran)
- [Response](#-response)
- [Dokumentasi Lengkap](#-dokumentasi-lengkap)
- [Sumber & Lisensi](#-sumber--lisensi)

## ✨ Sekilas

| | |
|---|---|
| 🌐 **Base URL** | `https://api-h2h.autolaris.com` |
| 📮 **Endpoint** | 5 service (lihat tabel di atas) |
| 🔑 **Auth** | `Authorization: Bearer <API_KEY>` |
| 📦 **Content-Type** | `application/json` |
| 📨 **Format** | `{ "rc": "00", "ket": "...", "data": {...} }` |
| 🧾 **Channel bayar** | QRIS · 8 Virtual Account · DANA (aktif bergantung akun) |

### 🔐 Kredensial

| Item | Nilai |
|---|---|
| Base URL | `https://api-h2h.autolaris.com` |
| API Key (Development) | `5fe67ad04a28099fb06b4e185ccf77124a777033913c5525fb49acf59e47b561` |
| Header | `Authorization: Bearer <API_KEY>` |
| Dashboard | https://seller.autolaris.com · [daftar](https://seller.autolaris.com/daftar) |

> ⚠️ Key di atas untuk **development**. Akses production wajib whitelist IP (maks 5); simpan key production sebagai secret.

## 🔄 Alur Integrasi

**Pengiriman** (Ongkir → Resi → Tracking → Cancel):

```mermaid
sequenceDiagram
    autonumber
    participant P as 🧑‍💻 Partner
    participant A as 🏢 AutoLaris
    P->>A: Cek Ongkir (origin, destination, berat, dimensi)
    A-->>P: daftar kurir + courir_id + harga
    P->>A: Create Resi (courir_id, alamat, order_details)
    A-->>P: awb + transaction_id
    P->>A: Tracking (awb)
    A-->>P: status + histories
    opt batalkan
        P->>A: Cancel Resi (transaction_id)
        A-->>P: sukses
    end
```

**Pembayaran** (Payment Gateway):

```mermaid
sequenceDiagram
    autonumber
    participant P as 🧑‍💻 Partner
    participant A as 🏢 AutoLaris
    participant C as 🛒 Pelanggan
    P->>A: Create Payment (channel, amount, callback_url)
    A-->>P: 200 { trx_id, VA/QRIS/url, total }
    P->>C: Tampilkan instruksi bayar
    C->>A: Bayar sebelum expired
    A->>P: Callback status (PAID)
    P-->>A: HTTP 200
    Note over P: Update order → PAID
```

## 🚀 Quick Start

**Cek Ongkir**

```bash
curl -X POST "https://api-h2h.autolaris.com/api/h2h/ongkir" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "origin": 3515140, "destination": 3173060, "weight": "1000", "length": "10", "width": "20", "height": "30" }'
```

**Create Payment**

```bash
curl -X POST "https://api-h2h.autolaris.com/api/h2h/create_payment" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "reff_id": "ORD-001",
    "channel_code": "VAMANDIRI",
    "customer_id": "31857118",
    "customer_name": "Budi Santoso",
    "customer_phone": "081234567890",
    "customer_email": "customer@example.com",
    "expired": "20270422094000",
    "amount": "25000",
    "callback_url": "https://your-domain.com/autolaris/callback"
  }'
```

<details>
<summary><b>Node.js (fetch)</b></summary>

```js
const res = await fetch("https://api-h2h.autolaris.com/api/h2h/create_payment", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.AUTOLARIS_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    reff_id: "ORD-001",
    channel_code: "QRIS",
    customer_id: "31857118",
    customer_name: "Budi Santoso",
    customer_phone: "081234567890",
    customer_email: "customer@example.com",
    expired: "20270422094000",
    amount: "25000",
    callback_url: "https://your-domain.com/autolaris/callback",
  }),
});
const json = await res.json();
if (json.rc !== "00") throw new Error(json.ket);
const { trx_id, virtual_account, qr, url, total } = json.data;
```

</details>

## 🏦 Channel Pembayaran

| Kode | Channel | Tipe |
|---|---|:---:|
| `QRIS` | QRIS | 📱 QR |
| `VABCA` | BCA Virtual Account | 🏦 VA |
| `VAMANDIRI` | Mandiri Virtual Account | 🏦 VA |
| `VABNI` | BNI Virtual Account | 🏦 VA |
| `VABRI` | BRI Virtual Account | 🏦 VA |
| `VAPERMATA` | Permata Virtual Account | 🏦 VA |
| `VABSI` | BSI Virtual Account | 🏦 VA |
| `VACIMB` | CIMB Niaga Virtual Account | 🏦 VA |
| `VADANAMON` | Danamon Virtual Account | 🏦 VA |
| `DANA` | E-Wallet DANA | 👛 E-Wallet |

> 💡 Field instruksi bayar pada response menyesuaikan channel: `VA*` → `virtual_account`, `QRIS` → `qr`, `DANA` → `url`.
> 🔎 **Tidak ada endpoint list-channels.** Aktif-tidaknya channel bergantung konfigurasi akun — cek via probe `create_payment`: `rc = "00"` (aktif) / `rc = "07"` (tidak aktif).

## 📥 Response

```json
{
  "rc": "00",
  "ket": "Sukses",
  "data": {
    "trx_id": "671647",
    "virtual_account": "8779611150001393",
    "qr": "",
    "payment_code": "",
    "url": "",
    "amount": 25000,
    "admin": 3000,
    "total": 28000
  }
}
```

> [!IMPORTANT]
> Tagihkan **`total`** (sudah termasuk `admin`) ke pelanggan, dan selalu cek **`rc == "00"`** sebelum memproses `data`.

**Response code** (diverifikasi live 2026-07-19): `00` = Sukses · `01` = `Invalid parameter` · `07` = channel tidak aktif.

> [!NOTE]
> Untuk **QRIS**, `qr` adalah payload EMVCo dan **nama merchant** (tag 59, CRC-signed) berasal dari **akun AutoLaris terdaftar** — tidak bisa ditimpa dari kode; atur via onboarding merchant. Contoh live QRIS: `amount 10000 → admin 70 → total 10070`.

## 📚 Dokumentasi Lengkap

<table>
<tr><td width="50%" valign="top">

### 📘 [AutoLaris-H2H-API.md](./AutoLaris-H2H-API.md)
Referensi **5 endpoint** lengkap:
- 🚚 Cek Ongkir (kurir, tarif, `courir_id`)
- 📦 Create Resi (Reguler/COD, `order_details`)
- 🔍 Tracking (histories, POD, status)
- ❌ Cancel Resi
- 💳 Create Payment (ringkas)

</td><td width="50%" valign="top">

### 💳 [AutoLaris-Payment-Gateway-API.md](./AutoLaris-Payment-Gateway-API.md)
Fokus **payment gateway**:
- 🏦 10 channel code (VA/QRIS/DANA) detail + cara probe channel aktif
- 🔔 Callback + handler **Node.js** & **PHP/Laravel**
- ⚠️ Error-handling & anti double-charge
- ✅ Checklist go-live
- ❓ Pertanyaan terbuka untuk vendor

</td></tr>
</table>

## 🔗 Sumber & Lisensi

- 🏪 Dashboard seller / request API Key → https://seller.autolaris.com
- 📝 Daftar akun → https://seller.autolaris.com/daftar

> Dokumentasi untuk tujuan integrasi. Seluruh merek dagang milik **AutoLaris**. Konfirmasikan detail final (format payload callback, zona waktu `expired`, signature) ke tim AutoLaris sebelum produksi.

📄 Lisensi dokumentasi: **[MIT](./LICENSE)**.

<div align="center"><sub>Dibuat untuk mempermudah developer Indonesia 🇮🇩 mengintegrasikan AutoLaris Payment Gateway.</sub></div>
