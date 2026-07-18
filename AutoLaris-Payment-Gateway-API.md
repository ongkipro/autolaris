# AutoLaris H2H — Payment Gateway API

> Dokumentasi lengkap **Create Payment** (Payment Gateway) pada AutoLaris H2H API.
> Fokus dokumen ini: **pembuatan transaksi pembayaran (VA / QRIS / E-Wallet)** beserta callback.

---

## 1. Ringkasan

AutoLaris H2H API adalah layanan integrasi (Host-to-Host) antara fitur AutoLaris dengan partner. Layanan terdiri dari:

1. Cek Ongkir
2. Create Resi
3. Tracking
4. Cancel Resi
5. **Create Payment** ← (fokus dokumen ini)

Fitur **Create Payment** memungkinkan partner membuat tagihan pembayaran melalui berbagai channel: **Virtual Account** (BCA, Mandiri, BNI, BRI, BSI, Permata), **QRIS**, dan **E-Wallet DANA**. Setelah tagihan dibuat, status pembayaran dikirim ke partner melalui **callback URL**.

### Diagram alur pembayaran

```mermaid
sequenceDiagram
    autonumber
    participant P as Partner
    participant A as AutoLaris
    participant C as Pelanggan
    P->>A: POST /api/h2h/create_payment (reff_id, channel_code, amount, callback_url)
    A-->>P: 200 { rc:"00", data:{ trx_id, virtual_account/qr/url, total } }
    P->>C: Tampilkan instruksi bayar (VA / QRIS / deeplink)
    C->>A: Bayar sebelum expired
    A->>P: POST callback_url (status pembayaran)
    P-->>A: HTTP 200 (terima)
    Note over P: Cocokkan via trx_id/reff_id, update order PAID
```

### Status transaksi

```mermaid
stateDiagram-v2
    [*] --> PENDING: create_payment sukses
    PENDING --> PAID: pelanggan bayar (callback)
    PENDING --> EXPIRED: lewat waktu expired
    PAID --> [*]
    EXPIRED --> [*]
```

---

## 2. Base URL & Environment

| Environment | Base URL |
|---|---|
| Production | `https://api-h2h.autolaris.com` |
| Development | `https://api-h2h.autolaris.com` (gunakan API Key development) |

**Catatan endpoint:** gunakan path single-slash: `https://api-h2h.autolaris.com/api/h2h/create_payment`.

---

## 3. Autentikasi & Kredensial

Seluruh endpoint memakai **Bearer Token** (API Key) pada header `Authorization`.

```
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**Kredensial:**

| Item | Nilai |
|---|---|
| Base URL | `https://api-h2h.autolaris.com` |
| API Key (Development) | `<API_KEY>` |
| Dashboard seller | https://seller.autolaris.com |
| Daftar akun | https://seller.autolaris.com/daftar |
| Akses production | Wajib **Whitelist IP Address** (maks. 5 IP) |

> ⚠️ Key di atas hanya untuk **development/testing**. Jangan pakai di produksi. Simpan API Key production sebagai secret (env var / secret manager), jangan commit ke repo.

---

## 4. Endpoint: Create Payment

Membuat tagihan pembayaran baru.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `https://api-h2h.autolaris.com/api/h2h/create_payment` |
| **Auth** | Bearer Token (API Key) |
| **Content-Type** | `application/json` |

### 4.1 Request Body

```json
{
  "reff_id": "2023022514112",
  "channel_code": "VAMANDIRI",
  "customer_id": "31857118",
  "customer_name": "testing name",
  "customer_phone": "081234567890",
  "customer_email": "emailpartner@gmail.com",
  "expired": "20270422094000",
  "amount": "11000",
  "callback_url": "https://url_callback_partner.com/callback"
}
```

### 4.2 Parameter Request

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `reff_id` | string | ✓ | ID referensi / ID transaksi dari sisi partner untuk memudahkan rekonsiliasi. Disarankan unik per transaksi. |
| `channel_code` | string | ✓ | Kode channel pembayaran. Lihat **§5 Daftar Channel Code**. |
| `customer_id` | string | ✓ | ID pelanggan dari sisi partner. |
| `customer_name` | string | ✓ | Nama pelanggan. |
| `customer_phone` | string | ✓ | Nomor telepon pelanggan. |
| `customer_email` | string | ✓ | Email pelanggan. |
| `expired` | string | ✓ | Waktu kedaluwarsa tagihan, format `YYYYMMDDHHMMSS` (contoh `20270422094000` = 2027-04-22 09:40:00). |
| `amount` | string/number | ✓ | Nominal tagihan (pokok). Biaya admin ditambahkan terpisah pada response (`total = amount + admin`). |
| `callback_url` | string | ✓ | URL milik partner untuk menerima notifikasi status pembayaran. |

### 4.3 Response — `200 OK`

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
    "amount": 11000,
    "admin": 3000,
    "total": 14000
  }
}
```

### 4.4 Field Response

| Field | Tipe | Keterangan |
|---|---|---|
| `rc` | string | Response code. `"00"` = sukses. |
| `ket` | string | Keterangan status (`"Sukses"`). |
| `data.trx_id` | string | ID transaksi pembayaran di sisi AutoLaris. **Simpan** untuk rekonsiliasi & pencocokan callback. |
| `data.virtual_account` | string | Nomor Virtual Account (terisi bila `channel_code` = salah satu `VA*`). |
| `data.qr` | string | Payload/string QRIS (terisi bila `channel_code` = `QRIS`). |
| `data.payment_code` | string | Kode pembayaran (bila channel memakai payment code). |
| `data.url` | string | URL pembayaran / redirect (bila channel memakai URL, mis. E-Wallet `DANA`). |
| `data.amount` | number | Nominal pokok. |
| `data.admin` | number | Biaya admin. |
| `data.total` | number | Total tagihan = `amount` + `admin`. Inilah nominal yang dibayar pelanggan. |

> **Catatan pemetaan channel → field instruksi bayar:**
> - `VA*` → `virtual_account` terisi.
> - `QRIS` → `qr` terisi (render jadi gambar QR).
> - `DANA` → kemungkinan `url` / `payment_code` terisi (redirect/deeplink ke aplikasi).
> Selalu cek field mana yang non-kosong sesuai channel yang dipilih.

### 4.5 Contoh Response QRIS (diverifikasi live 2026-07-19)

Request `channel_code = "QRIS"`, `amount = "10000"` menghasilkan:

```json
{
  "rc": "00",
  "ket": "Sukses",
  "data": {
    "trx_id": "...",
    "virtual_account": "",
    "qr": "00020101021226...5204...5303360540510000...6304XXXX",
    "payment_code": "",
    "url": "",
    "amount": 10000,
    "admin": 70,
    "total": 10070
  }
}
```

- `admin` untuk QRIS pada contoh ini **70** (biaya admin berbeda per channel; VA bisa berbeda). Tagihkan `total` (`10070`), bukan `amount`.
- `qr` adalah **payload EMVCo** siap di-render jadi gambar QR (mis. pakai library QR di sisi partner).

> **Catatan white-label (nama merchant di QRIS).** Payload EMVCo pada `qr` memuat tag **59 (Merchant Name)** yang berisi **nama merchant terdaftar milik akun AutoLaris**, dan payload di-tandatangani **CRC (tag 63)**. Nama merchant ini **tidak bisa ditimpa/ditulis ulang dari kode** — mengubah string `qr` akan merusak CRC dan membuat QR ditolak. Untuk menampilkan nama merchant tertentu (mis. white-label per tenant), atur lewat **onboarding/registrasi merchant di akun AutoLaris**, bukan di sisi integrasi.

---

## 5. Daftar Channel Code (Create Payment)

| Kode | Keterangan |
|---|---|
| `QRIS` | QRIS |
| `VABCA` | BCA Virtual Account |
| `VAMANDIRI` | Mandiri Virtual Account |
| `VABNI` | BNI Virtual Account |
| `VABRI` | BRI Virtual Account |
| `VAPERMATA` | Permata Virtual Account |
| `VABSI` | BSI Virtual Account |
| `VACIMB` | CIMB Niaga Virtual Account |
| `VADANAMON` | Danamon Virtual Account |
| `DANA` | E-Wallet DANA |

> **Tidak ada endpoint list-channels.** AutoLaris tidak menyediakan endpoint untuk melihat channel yang aktif pada suatu akun. Cara paling andal memastikan sebuah channel aktif adalah **memanggil `create_payment`** dengan `channel_code` tersebut:
> - `rc = "00"` → channel **aktif** (VA/QR ter-generate).
> - `rc = "07"` → channel **tidak aktif** untuk akun ini (aktifkan lewat onboarding/dashboard AutoLaris).
>
> Aktif-tidaknya sebuah channel bergantung pada konfigurasi akun; daftar di atas adalah kode yang **teramati**, bukan jaminan semuanya aktif.

---

## 6. Callback / Notifikasi Pembayaran

Setelah pelanggan membayar, AutoLaris mengirim notifikasi status ke `callback_url` yang dikirim saat Create Payment.

- **Wajib** sediakan endpoint publik yang dapat menerima `POST` dari AutoLaris.
- Lakukan pencocokan menggunakan `trx_id` dan/atau `reff_id`.
- Balas dengan `HTTP 200` agar AutoLaris menganggap callback terkirim sukses (idempotent: tangani kemungkinan retry/duplikat).

> Struktur payload callback belum dirinci. Konfirmasikan format payload final (field status, signature/verifikasi) ke tim AutoLaris sebelum go-live. Disarankan verifikasi keaslian callback (mis. cek IP whitelist / signature).

### 6.1 Asumsi payload callback (konfirmasi ke vendor)

Berdasarkan pola response Create Payment, payload callback **diperkirakan** mengandung minimal:

```json
{
  "trx_id": "671647",
  "reff_id": "2023022514112",
  "channel_code": "VAMANDIRI",
  "amount": 11000,
  "admin": 3000,
  "total": 14000,
  "status": "PAID",
  "paid_at": "2026-06-30 09:41:12"
}
```

> ⚠️ Field `status`, `paid_at`, dan ada/tidaknya signature **belum dikonfirmasi**. Jangan hardcode nilai status — buat mapping yang mudah diubah.

### 6.2 Contoh Handler Callback — Node.js / Express

```js
import express from "express";
const app = express();
app.use(express.json());

// (opsional) whitelist IP AutoLaris jika sudah diberikan vendor
const ALLOWED_IPS = (process.env.AUTOLARIS_CALLBACK_IPS || "").split(",").filter(Boolean);

app.post("/autolaris/callback", async (req, res) => {
  // 1) Verifikasi sumber (jika pakai IP whitelist)
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
  if (ALLOWED_IPS.length && !ALLOWED_IPS.some((a) => ip.includes(a))) {
    return res.status(403).json({ ok: false });
  }

  const { trx_id, reff_id, status } = req.body || {};
  if (!trx_id && !reff_id) return res.status(400).json({ ok: false });

  // 2) Cocokkan transaksi (pakai trx_id utama, reff_id cadangan)
  const order = await findOrderByTrxOrReff(trx_id, reff_id);
  if (!order) return res.status(404).json({ ok: false });

  // 3) Idempoten: abaikan jika sudah final
  if (order.status === "PAID") return res.status(200).json({ ok: true });

  // 4) Update status sesuai callback
  if (String(status).toUpperCase() === "PAID") {
    await markOrderPaid(order.id, req.body);
  }

  // 5) WAJIB balas 200 agar tidak di-retry terus
  return res.status(200).json({ ok: true });
});

app.listen(3000);
```

### 6.3 Contoh Handler Callback — PHP / Laravel

```php
// routes/api.php
Route::post('/autolaris/callback', [AutoLarisController::class, 'callback']);

// app/Http/Controllers/AutoLarisController.php
public function callback(Request $request)
{
    // 1) (opsional) verifikasi IP whitelist AutoLaris
    $allowed = array_filter(explode(',', env('AUTOLARIS_CALLBACK_IPS', '')));
    if ($allowed && !in_array($request->ip(), $allowed)) {
        return response()->json(['ok' => false], 403);
    }

    $trxId  = $request->input('trx_id');
    $reffId = $request->input('reff_id');
    $status = strtoupper((string) $request->input('status'));

    // 2) cocokkan order
    $order = Order::where('trx_id', $trxId)
        ->orWhere('reff_id', $reffId)
        ->first();
    if (!$order) {
        return response()->json(['ok' => false], 404);
    }

    // 3) idempoten
    if ($order->status === 'PAID') {
        return response()->json(['ok' => true], 200);
    }

    // 4) update status
    if ($status === 'PAID') {
        $order->update([
            'status'         => 'PAID',
            'paid_at'        => now(),
            'callback_dump'  => json_encode($request->all()),
        ]);
    }

    // 5) WAJIB 200
    return response()->json(['ok' => true], 200);
}
```

---

## 7. Response Code & Penanganan Error

| `rc` | `ket` (contoh) | Arti |
|---|---|---|
| `00` | `Sukses` | Transaksi berhasil dibuat — proses `data` |
| `01` | `Invalid parameter` | Parameter request tidak valid / field wajib kurang / format salah |
| `07` | — | Channel tidak aktif untuk akun ini (`channel_code` belum diaktifkan) |
| selain di atas | — | Gagal — lihat `ket` untuk detail pesan error |

> Selalu cek `rc == "00"` sebelum memproses `data`. Tangani non-`00` sebagai kegagalan dan log `ket`.
> `rc`, `ket`, `01`, dan `07` **diverifikasi live** 2026-07-19 (lihat §13). Kode lain di luar daftar tetap perlu ditangani sebagai kegagalan generik.

### Matriks penanganan error (rekomendasi sisi partner)

| Situasi | Cara deteksi | Tindakan |
|---|---|---|
| Sukses | HTTP 200 & `rc == "00"` | Proses `data`, tampilkan instruksi bayar |
| Gagal logis | HTTP 200 & `rc != "00"` | Log `ket`, tampilkan pesan ke user, jangan retry otomatis tanpa cek penyebab |
| Unauthorized | HTTP 401/403 | Cek API Key & whitelist IP production |
| Body invalid | HTTP 400 | Validasi field wajib & format `expired`/`amount` sebelum kirim |
| Timeout / 5xx | tidak ada response / HTTP 5xx | Retry dengan backoff; **jangan ganti `reff_id`** agar tidak dobel tagihan |
| Duplikat `reff_id` | `rc != "00"` + pesan duplikat | Ambil status transaksi lama, jangan buat baru |

> **Pencegahan double-charge:** simpan status "pending create_payment" sebelum memanggil API. Jika request timeout, lakukan rekonsiliasi via `reff_id`/`trx_id` sebelum membuat ulang.

---

## 8. Contoh Pemanggilan

### cURL

```bash
curl -X POST "https://api-h2h.autolaris.com/api/h2h/create_payment" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "reff_id": "2023022514112",
    "channel_code": "VAMANDIRI",
    "customer_id": "31857118",
    "customer_name": "testing name",
    "customer_phone": "081234567890",
    "customer_email": "emailpartner@gmail.com",
    "expired": "20270422094000",
    "amount": "11000",
    "callback_url": "https://url_callback_partner.com/callback"
  }'
```

### Node.js (fetch)

```js
const res = await fetch("https://api-h2h.autolaris.com/api/h2h/create_payment", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.AUTOLARIS_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    reff_id: "2023022514112",
    channel_code: "QRIS",
    customer_id: "31857118",
    customer_name: "testing name",
    customer_phone: "081234567890",
    customer_email: "customer@example.com",
    expired: "20270422094000",
    amount: "11000",
    callback_url: "https://your-domain.com/autolaris/callback",
  }),
});

const json = await res.json();
if (json.rc !== "00") throw new Error(`Create payment gagal: ${json.ket}`);
const { trx_id, virtual_account, qr, url, total } = json.data;
// VA -> virtual_account, QRIS -> qr, DANA -> url
```

### PHP (cURL) — Create Payment

```php
$payload = [
    "reff_id"      => "2023022514112",
    "channel_code" => "VABCA",
    "customer_id"  => "31857118",
    "customer_name"=> "testing name",
    "customer_phone" => "081234567890",
    "customer_email" => "customer@example.com",
    "expired"      => "20270422094000",
    "amount"       => "11000",
    "callback_url" => "https://your-domain.com/autolaris/callback",
];

$ch = curl_init("https://api-h2h.autolaris.com/api/h2h/create_payment");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer " . getenv("AUTOLARIS_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
]);
$res = json_decode(curl_exec($ch), true);
curl_close($ch);

if (($res['rc'] ?? '') !== '00') {
    throw new RuntimeException('Create payment gagal: ' . ($res['ket'] ?? 'unknown'));
}
$data = $res['data']; // trx_id, virtual_account / qr / url, total
```

---

## 9. Alur Integrasi (rekomendasi)

```
1. Partner -> POST /api/h2h/create_payment  (kirim reff_id, channel_code, amount, callback_url)
2. AutoLaris -> response { trx_id, virtual_account|qr|url, total }
3. Partner tampilkan instruksi bayar ke pelanggan (VA / QRIS / deeplink)
4. Pelanggan bayar sebelum `expired`
5. AutoLaris -> POST callback_url (status pembayaran)
6. Partner cocokkan via trx_id/reff_id, update status order, balas HTTP 200
```

---

## 10. Catatan & Best Practice

- **Idempotensi `reff_id`:** gunakan ID unik per transaksi agar mudah rekonsiliasi (mengacu pola endpoint lain pada koleksi yang melarang `reff_id` sama pada hari yang sama).
- **Simpan `trx_id`** dari response untuk pelacakan & pencocokan callback.
- **`total` ≠ `amount`:** tagihkan `total` (sudah termasuk `admin`) ke pelanggan.
- **`expired`:** format `YYYYMMDDHHMMSS`. Pastikan zona waktu disepakati dengan AutoLaris (kemungkinan WIB).
- **Keamanan:** simpan API Key production di env/secret manager; jangan hardcode; whitelist IP production (maks 5).
- **Callback:** sediakan endpoint stabil, balas 200, tangani retry/duplikat, verifikasi keaslian sumber.

---

## 11. Checklist Go-Live

- [ ] API Key production disimpan di secret manager
- [ ] IP server production sudah di-whitelist (maks 5) di dashboard AutoLaris
- [ ] Endpoint `callback_url` publik, HTTPS, balas `200`, idempotent
- [ ] Format payload callback & field `status` dikonfirmasi ke vendor
- [ ] Zona waktu `expired` dikonfirmasi (WIB?)
- [ ] Mekanisme verifikasi keaslian callback (IP/signature) disepakati
- [ ] Logging request/response + `trx_id`/`reff_id` untuk audit
- [ ] Penanganan timeout & anti double-charge teruji
- [ ] Uji tiap channel: QRIS, VA (6 bank), DANA
- [ ] Tagihan ke user pakai `total` (sudah termasuk `admin`)

## 12. Pertanyaan Terbuka untuk Tim AutoLaris

| # | Pertanyaan |
|---|---|
| 1 | Struktur lengkap & field payload callback (terutama nama field `status` dan nilai-nilainya: PAID/EXPIRED/FAILED?) |
| 2 | Apakah callback memakai signature/HMAC? Bagaimana cara verifikasinya? |
| 3 | Daftar IP source callback untuk di-whitelist di sisi partner |
| 4 | Zona waktu acuan untuk `expired` dan `paid_at` |
| 5 | Apakah ada endpoint "cek status pembayaran" (inquiry) untuk rekonsiliasi manual? |
| 6 | Besaran biaya `admin` per channel (flat/persentase?) |
| 7 | Batas minimum/maksimum `amount` per channel |
| 8 | Perilaku jika `reff_id` dikirim ulang (sama hari / beda hari) |

---

## 13. Catatan Verifikasi Live

> **2026-07-19 — diverifikasi live saat integrasi Formalin** (base `https://api-h2h.autolaris.com`):
> - `POST /api/h2h/create_payment` dengan header `Authorization: Bearer <API_KEY>` mengembalikan `rc = "00"` beserta VA/QR asli.
> - **Tabel `rc`** terkonfirmasi: `00` = Sukses, `01` = `Invalid parameter`, `07` = channel tidak aktif (§7).
> - Response `data` menyertakan `admin` + `total` (`total = amount + admin`); contoh QRIS `amount 10000 → admin 70 → total 10070` (§4.5).
> - **Nama merchant pada QRIS** ditentukan oleh akun (tag 59 EMVCo, CRC-signed) — dikonfigurasi via onboarding, bukan via kode (§4.5).
> - **Tidak ada endpoint list-channels**; status channel dicek dengan probe `create_payment` (`00` aktif / `07` tidak aktif) (§5).

---

## Lampiran — Endpoint lain pada koleksi (ringkas)

Hanya untuk konteks; detail lengkap di [AutoLaris-H2H-API.md](./AutoLaris-H2H-API.md).

| Endpoint | Method | URL | Fungsi |
|---|---|---|---|
| Cek Ongkir | POST | `/api/h2h/ongkir` | Cek tarif & layanan ekspedisi |
| Create Resi | POST | `/api/h2h/order` | Buat order/resi pengiriman (REGULER/COD) |
| Tracking | POST | `/api/h2h/lacak` | Lacak status kiriman by `awb` |
| Cancel Resi | POST | `/api/h2h/cancel` | Batalkan resi by `transaction_id` |
| **Create Payment** | POST | `/api/h2h/create_payment` | **Buat tagihan pembayaran (VA/QRIS/E-Wallet)** |

---

_Untuk format payload callback final dan zona waktu `expired`, konfirmasi ke tim AutoLaris sebelum produksi._
