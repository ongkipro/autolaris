# AutoLaris H2H API — Referensi Endpoint

Referensi ini mengikuti koleksi Postman AutoLaris `latest` yang diperiksa pada 2026-08-18. Nama field seperti `reff_id` dan `courir_id` mempertahankan ejaan API.

Untuk contoh Astro, Next.js, Node.js, Cloudflare Workers, dan PHP, lihat [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md).

## Informasi umum

| Item | Nilai |
|---|---|
| Base URL | `https://api-h2h.autolaris.com` |
| Authentication | `Authorization: Bearer <API_KEY>` |
| Request format | JSON; kecuali `GET /api/h2h/list_payment` tanpa body |
| Response format | `{ "rc": "00", "ket": "...", "data": ... }` |
| Production | API Key production dan whitelist maksimal 5 IP |

API Key diperoleh melalui [dashboard seller](https://seller.autolaris.com). Working tree hanya memakai placeholder; lihat [catatan credential dan rotasi](./README.md#sumber) sebelum menggunakan key development dari sumber mana pun.

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

Selalu periksa HTTP status **dan** `rc`:

```ts
if (!response.ok || payload.rc !== "00") {
  throw new Error(payload.ket || `AutoLaris HTTP ${response.status}`);
}
```

`data` dapat berupa object, array, atau array kosong.

## Endpoint matrix

| # | Service | Method | Path |
|---|---|---:|---|
| 1 | [Cek Ongkir](#1-cek-ongkir) | `POST` | `/api/h2h/ongkir` |
| 2 | [Create Resi](#2-create-resi) | `POST` | `/api/h2h/order` |
| 3 | [Tracking](#3-tracking) | `POST` | `/api/h2h/lacak` |
| 4 | [Cancel Resi](#4-cancel-resi) | `POST` | `/api/h2h/cancel` |
| 5 | [Create Payment](#5-create-payment) | `POST` | `/api/h2h/create_payment` |
| 6 | [List Payment Channel](#6-list-payment-channel) | `GET` | `/api/h2h/list_payment` |
| 7 | [Create Order](#7-create-order) | `POST` | `/api/h2h/submit` |

## Pilih flow yang tepat

| Kebutuhan | Flow |
|---|---|
| Tarif saja | `ongkir` |
| Pengiriman terpisah dari payment | `ongkir` → `order` → `lacak` / `cancel` |
| Tagihan payment saja | `list_payment` → `create_payment` |
| Order + pengiriman + payment terpadu | `ongkir` → `list_payment` → `submit` |

`/order` dan `/submit` bukan alias. `/order` mengembalikan `awb` langsung untuk flow pengiriman; `/submit` mengembalikan rincian biaya, pickup, buyer, dan instruksi payment pada satu transaksi.

---

## 1. Cek Ongkir

`POST /api/h2h/ongkir`

Mengambil layanan ekspedisi, harga, kemampuan COD/asuransi/pickup, dan `courir_id` untuk rute tertentu.

### Request

```json
{
  "origin": 3515140,
  "destination": 3173060,
  "weight": "1000",
  "length": "10",
  "width": "20",
  "height": "30"
}
```

| Field | Tipe pada contoh | Satuan / arti |
|---|---|---|
| `origin` | number | ID area pengirim |
| `destination` | number | ID area penerima |
| `weight` | string | gram |
| `length` | string | cm |
| `width` | string | cm |
| `height` | string | cm |

Data ID area: [Google Sheet AutoLaris](https://docs.google.com/spreadsheets/d/130zcs6uHmEtHuPc-WFx0BjlVjo7Ag6WmeUGiYozvRAk/edit?usp=sharing).

### Response sukses

```json
{
  "rc": "00",
  "ket": "Success",
  "data": [
    {
      "courier_code": "idx",
      "courier_name": "ID Express",
      "service_detail": [
        {
          "courir_id": "6",
          "service": "STD",
          "service_group": "Reguler",
          "service_code": "idx_reguler",
          "duration": "2-3 Hari",
          "etd": "26 Oct - 27 Oct",
          "price": 29000,
          "is_cod": true,
          "is_asuransi": true,
          "is_pickup": true
        }
      ]
    }
  ]
}
```

| Field | Penggunaan |
|---|---|
| `courir_id` | Kirim ke `order` atau `submit`. Jangan map dari `courier_code` sendiri. |
| `price` | Tarif pengiriman dari quote saat ini. |
| `is_cod` | Layanan mendukung COD. |
| `is_asuransi` | Layanan mendukung asuransi. Koleksi menyebut kalkulasi memakai persentase `insurance`, tetapi sample response terbaru tidak memuat field itu. |
| `is_pickup` | Layanan mendukung pickup. |
| `duration` / `etd` | Estimasi, bukan SLA. |

Kurir bergantung pada rute dan konfigurasi akun. Gunakan response runtime, bukan daftar hardcoded.

---

## 2. Create Resi

`POST /api/h2h/order`

Membuat resi pengiriman reguler (`type: 1`) atau COD (`type: 2`).

### Request

```json
{
  "reff_id": "123456",
  "courir_id": 18,
  "origin": 3515140,
  "destination": 3173060,
  "weight": "1000",
  "length": "10",
  "width": "20",
  "height": "30",
  "shipper_name": "Toko Joss",
  "shipper_phone": "081331115552",
  "shipper_email": "toko@example.com",
  "shipper_address": "Jl. Contoh 1",
  "receiver_name": "Budi Santoso",
  "receiver_phone": "081331000000",
  "receiver_email": "budi@example.com",
  "receiver_address": "Jl. Tujuan 5, Sidoarjo",
  "callback_url": "https://partner.example/autolaris/tracking",
  "type": 1,
  "grand_total": "12000",
  "cod_value": "0",
  "longitude": "",
  "latitude": "",
  "remark": "",
  "order_details": [
    { "name": "Produk A", "qty": "2", "unit_price": "2000" },
    { "name": "Produk B", "qty": "1", "unit_price": "8000" }
  ]
}
```

| Field | Kontrak yang dipublikasikan |
|---|---|
| `reff_id` | ID partner, maksimal 30 digit, tidak boleh sama pada hari yang sama. |
| `courir_id` | ID layanan dari response Cek Ongkir. |
| `origin` / `destination` | ID area pengirim / penerima. |
| `weight` / dimensi | Berat gram dan dimensi cm. Contoh vendor memakai string. |
| `shipper_*` / `receiver_*` | Identitas dan alamat pengiriman. |
| `callback_url` | URL update status tracking. Payload callback belum dipublikasikan. |
| `type` | `1` reguler; `2` COD. |
| `grand_total` | Nilai barang. |
| `cod_value` | Nominal yang ditagihkan kepada penerima untuk COD. |
| `order_details[]` | Produk dengan `name`, `qty`, dan `unit_price`. |

### Response sukses

```json
{
  "rc": "00",
  "ket": "Success",
  "data": {
    "awb": "ALDMY20251023155938",
    "transaction_id": "13518",
    "reff_id": "123456"
  }
}
```

Simpan:

- `awb` untuk Tracking;
- `transaction_id` untuk Cancel Resi;
- `reff_id` sebagai kunci rekonsiliasi di aplikasi partner.

---

## 3. Tracking

`POST /api/h2h/lacak`

### Request

```json
{
  "awb": "ALDMY20251023155938"
}
```

### Response sukses

```json
{
  "rc": "00",
  "ket": "Success",
  "data": {
    "awb": "ALDMY20251023155938",
    "awb_koli": [],
    "awb_sequence": 0,
    "courier_code": "jnt",
    "courier_name": "J&t Express",
    "created": "2025-05-24T10:59:33.531998Z",
    "delivered_date": "2025-05-26",
    "desc": "Paket telah diterima",
    "driver_name": "",
    "driver_phone": "",
    "etd": "26 May - 30 May",
    "histories": [
      {
        "desc": "Manifes",
        "code": "101",
        "date": "2025-05-24",
        "time": "10:59",
        "image": "",
        "driver_name": "",
        "driver_phone": ""
      },
      {
        "desc": "Paket telah diterima",
        "code": "200",
        "date": "2025-05-26",
        "time": "12:04",
        "image": "https://example.com/pod.jpg",
        "driver_name": "",
        "driver_phone": ""
      }
    ],
    "pod_image": "https://example.com/pod.jpg",
    "pod_receiver": "Penerima",
    "service": "EZ",
    "stats": "DELIVERED"
  }
}
```

Field penerima dan pengirim lain yang teramati: `recipient_district`, `recipient_name`, `recipient_regency`, `shipper_district`, `shipper_name`, dan `shipper_regency`.

Kode histori yang ada pada sample vendor:

| Code | Sample meaning |
|---|---|
| `101` | Manifest dibuat |
| `100` | Proses/transit |
| `200` | Diterima |

Jangan jadikan tabel sample ini sebagai enum lengkap; kurir lain dapat mengirim kode lain. Untuk status akhir, gunakan mapping yang disepakati dengan AutoLaris.

---

## 4. Cancel Resi

`POST /api/h2h/cancel`

### Request

```json
{
  "transaction_id": "13518"
}
```

`transaction_id` berasal dari Create Resi.

### Response sukses

```json
{
  "rc": "00",
  "ket": "Success",
  "data": []
}
```

`data: []` adalah response sukses yang valid untuk endpoint ini.

---

## 5. Create Payment

`POST /api/h2h/create_payment`

Membuat tagihan tanpa membuat pengiriman. Gunakan [List Payment Channel](#6-list-payment-channel) lebih dulu agar `channel_code` dan fee mengikuti konfigurasi akun saat ini.

### Request

```json
{
  "reff_id": "PAY-20260818-001",
  "channel_code": "VAMANDIRI",
  "customer_id": "31857118",
  "customer_name": "Budi Santoso",
  "customer_phone": "081234567890",
  "customer_email": "budi@example.com",
  "expired": "20260818235959",
  "amount": "11000",
  "callback_url": "https://partner.example/autolaris/payment"
}
```

| Field | Arti |
|---|---|
| `reff_id` | Referensi transaksi partner. Aturan duplikat endpoint ini belum dipublikasikan. |
| `channel_code` | Kode dari `GET /list_payment`. |
| `customer_*` | Identitas pelanggan. |
| `expired` | Format contoh `YYYYMMDDHHMMSS`; timezone belum dipublikasikan. |
| `amount` | Nominal pokok. |
| `callback_url` | Endpoint notifikasi partner; kontrak payload/signature belum dipublikasikan. |

### Response sukses

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

Gunakan field instruksi yang terisi:

- Virtual Account: `virtual_account`;
- QRIS: `qr` berisi payload EMVCo, bukan URL gambar;
- redirect/e-wallet: `url` dan/atau `payment_code`;
- nominal pelanggan: `total`, bukan `amount`.

Detail payment dan caveat callback: [AutoLaris-Payment-Gateway-API.md](./AutoLaris-Payment-Gateway-API.md).

---

## 6. List Payment Channel

`GET /api/h2h/list_payment`

Mengambil channel aktif beserta konfigurasi biaya untuk akun yang memakai API Key tersebut.

### Request

Tidak ada body.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AUTOLARIS_API_KEY" \
  "https://api-h2h.autolaris.com/api/h2h/list_payment"
```

### Response sukses

```json
{
  "rc": "00",
  "ket": "Sukses",
  "data": [
    {
      "channel_code": "COD",
      "name": "COD",
      "admin": "0.0",
      "tipe_admin": "fix"
    },
    {
      "channel_code": "QRIS",
      "name": "QRIS",
      "admin": "0.7",
      "tipe_admin": "persen"
    },
    {
      "channel_code": "VAMANDIRI",
      "name": "Bank Mandiri",
      "admin": "3000.0",
      "tipe_admin": "fix"
    }
  ]
}
```

Koleksi terbaru menampilkan `COD`, `QRIS`, `VABNI`, `VAPERMATA`, `VABCA`, `VAMANDIRI`, `VABRI`, dan `OVO` pada satu response contoh. Ini bukan daftar global: channel dapat berbeda per akun dan waktu.

| `tipe_admin` | Interpretasi |
|---|---|
| `fix` | `admin` berupa nominal tetap. |
| `persen` | `admin` berupa persentase, misalnya `0.7`. |

Jangan menghitung total final hanya dari tabel ini bila endpoint transaksi sudah mengembalikan `admin` dan `total`; response transaksi adalah sumber nominal yang ditagihkan.

---

## 7. Create Order

`POST /api/h2h/submit`

Membuat order terpadu dengan pengiriman dan channel pembayaran.

### Request

```json
{
  "reff_id": "1000001",
  "channel_code": "QRIS",
  "courir_id": 6,
  "origin": 3517100,
  "destination": 3518010,
  "weight": "1000",
  "length": "10",
  "width": "20",
  "height": "30",
  "shipper_name": "Toko Testing",
  "shipper_phone": "08123456789",
  "shipper_email": "toko@example.com",
  "shipper_address": "Jl. Pengirim 1",
  "receiver_name": "Budi Santoso",
  "receiver_phone": "081331000000",
  "receiver_email": "budi@example.com",
  "receiver_address": "Jl. Penerima 5",
  "callback_url": "https://partner.example/autolaris/order",
  "grand_total": "12000",
  "cod_value": "20150",
  "longitude": "",
  "latitude": "",
  "remark": "testing api h2h",
  "order_details": [
    { "name": "Produk A", "qty": "2", "unit_price": "2000" },
    { "name": "Produk B", "qty": "1", "unit_price": "8000" }
  ]
}
```

`courir_id` berasal dari Cek Ongkir. `channel_code` berasal dari List Payment Channel. Contoh vendor memakai `COD` pada request aktif dan `QRIS` pada stored response; keduanya menunjukkan endpoint ini memilih payment dalam flow order.

### Response sukses

```json
{
  "rc": "00",
  "ket": "Success",
  "data": {
    "channel_code": "QRIS",
    "transaction_id": "874546",
    "reff_id": "1000001",
    "biaya_kirim": 18400,
    "biaya_cod": 0,
    "biaya_admin": 84,
    "biaya_asuransi": 0,
    "diskon": 84,
    "total": 30400,
    "pickup_info": {
      "id_area": 3517100,
      "nama": "Toko Testing",
      "hp": "08123456789",
      "email": "toko@example.com",
      "alamat": "Jl. Pengirim 1",
      "kecamatan": "SUMOBITO",
      "kota": "KABUPATEN JOMBANG",
      "propinsi": "JAWA TIMUR",
      "kodepos": "61483",
      "longitude": "",
      "latitude": ""
    },
    "buyer_info": {
      "id_area": 3518010,
      "nama": "Budi Santoso",
      "hp": "081331000000",
      "email": "budi@example.com",
      "alamat": "Jl. Penerima 5",
      "kecamatan": "SAWAHAN",
      "kota": "KABUPATEN NGANJUK",
      "propinsi": "JAWA TIMUR",
      "kodepos": "64475",
      "longitude": "",
      "latitude": ""
    },
    "payment_info": {
      "expired": "2026-07-23 14:09:05",
      "va": "",
      "qr": "00020101021226...6304ABCD",
      "url": ""
    }
  }
}
```

Simpan `transaction_id` dan `reff_id`. Tampilkan instruksi dari `payment_info.va`, `payment_info.qr`, atau `payment_info.url` sesuai channel. Nominal final berasal dari `data.total`.

Koleksi terbaru tidak memperlihatkan `awb` pada response Create Order. Konfirmasikan cara memperoleh resi dan status lanjutan untuk flow `/submit` sebelum production.

---

## Error handling

Kode yang teramati pada dokumentasi repository dan koleksi:

| `rc` | Arti |
|---|---|
| `00` | Sukses; proses `data`. |
| `01` | Invalid parameter pada Create Payment. |
| `07` | Channel tidak aktif pada Create Payment. |
| lainnya | Kegagalan; tampilkan/log `ket` secara aman. |

Daftar ini tidak lengkap. Jangan retry semua non-`00` secara otomatis.

Untuk request yang membuat transaksi:

1. simpan `reff_id` sebelum request;
2. bila timeout atau 5xx, pertahankan `reff_id` yang sama;
3. jangan membuat transaksi baru sampai status request lama direkonsiliasi;
4. simpan identifier response (`transaction_id`, `trx_id`, `awb`) secara atomik dengan state transaksi.

## Batas kontrak

Belum dipublikasikan pada koleksi:

- required/optional matrix formal untuk seluruh field;
- callback payload, signature, source IP, dan retry policy;
- payment inquiry endpoint;
- timezone `expired`;
- seluruh error code dan rate limit;
- cara mengambil `awb` setelah Create Order `/submit`.

Konfirmasikan bagian tersebut kepada AutoLaris sebelum go-live.

## Sumber

- [Koleksi Postman AutoLaris H2H](https://documenter.getpostman.com/view/25938923/2sB2iwFuwz)
- [Dashboard seller](https://seller.autolaris.com)
- [Data area](https://docs.google.com/spreadsheets/d/130zcs6uHmEtHuPc-WFx0BjlVjo7Ag6WmeUGiYozvRAk/edit?usp=sharing)
- [OpenAPI snapshot repository](./openapi.json)
