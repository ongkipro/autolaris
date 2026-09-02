# Panduan Integrasi AutoLaris Lintas Stack

Panduan ini menempatkan API Key di server dan memberi pola copy-paste untuk Astro, Next.js, Node.js, Cloudflare Workers, dan PHP. Semua contoh menggunakan native `fetch` atau cURL; tidak ada dependency wajib.

## 1. Environment

```dotenv
AUTOLARIS_API_KEY=<YOUR_API_KEY>
```

Aturan:

- jangan gunakan prefix public seperti `PUBLIC_`, `NEXT_PUBLIC_`, atau `VITE_`;
- jangan log header `Authorization`;
- jangan commit file environment;
- production membutuhkan IP egress yang sudah di-whitelist AutoLaris.

## 2. Client TypeScript bersama

Simpan sebagai `src/lib/autolaris.ts` pada Astro/Next.js, atau `autolaris.ts` pada Node.js.

```ts
const BASE_URL = "https://api-h2h.autolaris.com";

type ApiEnvelope<T> = {
  rc: string;
  ket: string;
  data: T;
};

export class AutoLarisError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly responseCode?: string,
  ) {
    super(message);
    this.name = "AutoLarisError";
  }
}

export function createAutoLarisClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey) throw new Error("AUTOLARIS_API_KEY is not configured");

  async function requestEnvelope<T>(
    path: string,
    options: { method?: "GET" | "POST"; body?: unknown } = {},
  ): Promise<ApiEnvelope<T>> {
    const method = options.method ?? "POST";
    const response = await fetcher(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    let payload: ApiEnvelope<T>;

    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new AutoLarisError(
        `AutoLaris returned a non-JSON response (${response.status})`,
        response.status,
      );
    }

    if (!response.ok) {
      throw new AutoLarisError(
        payload.ket || `AutoLaris request failed (${response.status})`,
        response.status,
        payload.rc,
      );
    }

    return payload;
  }

  async function request<T>(
    path: string,
    options: { method?: "GET" | "POST"; body?: unknown } = {},
  ): Promise<T> {
    const payload = await requestEnvelope<T>(path, options);
    if (payload.rc !== "00") {
      throw new AutoLarisError(payload.ket, 200, payload.rc);
    }
    return payload.data;
  }

  return {
    cekOngkir: <T>(body: unknown) => request<T>("/api/h2h/ongkir", { body }),
    createResi: <T>(body: unknown) => request<T>("/api/h2h/order", { body }),
    tracking: <T>(awb: string) =>
      request<T>("/api/h2h/lacak", { body: { awb } }),
    cancelResi: <T>(transactionId: string) =>
      request<T>("/api/h2h/cancel", {
        body: { transaction_id: transactionId },
      }),
    createPayment: <T>(body: unknown) =>
      request<T>("/api/h2h/create_payment", { body }),
    listPayment: <T>() =>
      request<T>("/api/h2h/list_payment", { method: "GET" }),
    createOrder: <T>(body: unknown) =>
      request<T>("/api/h2h/submit", { body }),
    advice: (transactionId: string) =>
      requestEnvelope<{ awb?: string }>("/api/h2h/advice", {
        body: { transaction_id: transactionId },
      }),
  };
}
```

Kenapa wrapper memeriksa dua lapis error:

1. HTTP non-2xx menangkap authentication, gateway, atau server failure.
2. `rc !== "00"` menangkap logical failure yang dapat dikirim dengan HTTP `200`.

Tambahkan schema validation di trust boundary aplikasi bila project sudah memakai Zod, Valibot, atau validator lain. Jangan menambah dependency hanya untuk menyalin contoh ini.

## 3. Node.js

Node.js 18+ menyediakan `fetch` bawaan.

```ts
import { createAutoLarisClient } from "./autolaris.js";

const autolaris = createAutoLarisClient(process.env.AUTOLARIS_API_KEY ?? "");

const channels = await autolaris.listPayment<
  Array<{
    channel_code: string;
    name: string;
    admin: string;
    tipe_admin: "fix" | "persen" | string;
  }>
>();

console.log(channels);
```

Untuk cek ongkir:

```ts
const quotes = await autolaris.cekOngkir({
  origin: 3515140,
  destination: 3173060,
  weight: "1000",
  length: "10",
  width: "20",
  height: "30",
});
```

## 4. Astro

Prasyarat: project memakai server adapter. Endpoint ini tidak dapat berjalan sebagai static-only output.

```ts
// src/pages/api/autolaris/ongkir.ts
import type { APIRoute } from "astro";
import {
  AutoLarisError,
  createAutoLarisClient,
} from "../../../lib/autolaris";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = await request.json();
    const client = createAutoLarisClient(
      import.meta.env.AUTOLARIS_API_KEY,
    );
    const data = await client.cekOngkir(input);
    return Response.json({ data });
  } catch (error) {
    if (error instanceof AutoLarisError) {
      return Response.json(
        { error: error.message, rc: error.responseCode },
        { status: error.httpStatus >= 400 ? error.httpStatus : 502 },
      );
    }
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
};
```

Frontend memanggil endpoint milik aplikasi, bukan AutoLaris:

```ts
const response = await fetch("/api/autolaris/ongkir", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData),
});
```

Tambahkan authentication, authorization, rate limit, dan validasi input sesuai trust boundary aplikasi. Proxy tanpa kontrol akan mengekspos kuota AutoLaris kepada publik.

## 5. Next.js App Router

Route Handler berjalan di server. Buat client di module route agar secret tidak melintasi Client Component boundary:

```ts
// src/app/api/autolaris/ongkir/route.ts
import { NextResponse } from "next/server";
import {
  AutoLarisError,
  createAutoLarisClient,
} from "@/lib/autolaris";

const autolaris = createAutoLarisClient(
  process.env.AUTOLARIS_API_KEY ?? "",
);

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const data = await autolaris.cekOngkir(input);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AutoLarisError) {
      return NextResponse.json(
        { error: error.message, rc: error.responseCode },
        { status: error.httpStatus >= 400 ? error.httpStatus : 502 },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

Jangan mengimpor module yang membaca `AUTOLARIS_API_KEY` dari file dengan directive `"use client"`. Untuk defense-in-depth dengan package `server-only`, ikuti dokumentasi Next.js dan install package tersebut secara eksplisit; contoh inti di atas tidak membutuhkannya.

## 6. Cloudflare Workers

Simpan key sebagai Worker secret binding `AUTOLARIS_API_KEY`, bukan plaintext di `wrangler.jsonc`.

```ts
interface Env {
  AUTOLARIS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/api/ongkir") {
      return new Response("Not found", { status: 404 });
    }

    const upstream = await fetch(
      "https://api-h2h.autolaris.com/api/h2h/ongkir",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AUTOLARIS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(await request.json()),
      },
    );

    const payload = await upstream.json<{
      rc: string;
      ket: string;
      data: unknown;
    }>();

    if (!upstream.ok || payload.rc !== "00") {
      return Response.json(
        { error: payload.ket, rc: payload.rc },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }

    return Response.json({ data: payload.data });
  },
};
```

Catatan production: pastikan IP egress runtime yang dipakai dapat memenuhi whitelist AutoLaris. Konfirmasikan model whitelist dengan vendor sebelum memilih serverless runtime.

## 7. PHP

```php
<?php

function autolaris(string $path, ?array $body = null, string $method = 'POST'): array
{
    $apiKey = getenv('AUTOLARIS_API_KEY');
    if (!$apiKey) {
        throw new RuntimeException('AUTOLARIS_API_KEY is not configured');
    }

    $headers = ['Authorization: Bearer ' . $apiKey];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $ch = curl_init('https://api-h2h.autolaris.com' . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body),
        CURLOPT_TIMEOUT => 30,
    ]);

    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('AutoLaris network error: ' . $curlError);
    }

    $payload = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
    if ($status < 200 || $status >= 300 || ($payload['rc'] ?? '') !== '00') {
        throw new RuntimeException($payload['ket'] ?? "AutoLaris HTTP {$status}");
    }

    return $payload['data'];
}

$channels = autolaris('/api/h2h/list_payment', null, 'GET');
```

## 8. Profil Create Order payment-only

Untuk produk digital, subscription, atau pembayaran non-fisik, akun yang telah
menyetujui klasifikasi AutoLaris dapat memakai `/submit` dengan payload lengkap
berikut. Ganti semua data contoh dengan data order lokal yang sudah tervalidasi;
`reff_id` harus stabil dan dipersist sebelum request agar retry tidak mencetak
tagihan kedua.

```json
{
  "reff_id": "1000001",
  "channel_code": "QRIS",
  "courir_id": 1,
  "origin": 3517100,
  "destination": 3518010,
  "weight": "1000",
  "length": "1",
  "width": "1",
  "height": "1",
  "shipper_name": "Merchant Name",
  "shipper_phone": "6281234567890",
  "shipper_email": "merchant@example.com",
  "shipper_address": "Merchant address",
  "receiver_name": "Customer Name",
  "receiver_phone": "6281234567890",
  "receiver_email": "customer@example.com",
  "receiver_address": "Customer address",
  "callback_url": "",
  "grand_total": "10000",
  "cod_value": "0",
  "longitude": "",
  "latitude": "",
  "remark": "1000001",
  "order_details": [
    {
      "name": "Digital product or subscription",
      "qty": "1",
      "unit_price": "10000"
    }
  ]
}
```

Tetap kirim field required `/submit`, termasuk `origin`, `destination`, identitas,
dimensi, dan `order_details`. Field tersebut adalah metadata schema, bukan
instruksi shipment pada profil ini. Jangan membuat AWB, pickup, atau dispatch.
Jangan memanggil `/create_payment` untuk checkout yang sudah berhasil `/submit`.

`remark` memakai `reff_id`/nomor order lokal, bukan `provider_transaction_id`:
ID provider baru tersedia **setelah** `/submit` berhasil dan harus disimpan dari
response untuk Advice.

`courir_id: 1` merupakan kontrak operasional akun, bukan jaminan publik Postman.

Untuk produk fisik, gunakan `courir_id` hasil `/ongkir` dan ikuti `/order` atau
`/submit` terpadu sesuai [referensi H2H](../reference/h2h-api.md).

## 9. Advice pada scheduled job

```ts
const result = await autolaris.advice(providerTransactionId);

if (result.rc === "02" && result.ket.toUpperCase() === "PENDING") {
  // no-op
} else if (
  result.rc === "00" &&
  ["PAID", "SETTLED", "LUNAS"].includes(
    result.ket.toUpperCase(),
  )
) {
  // guarded, idempotent local paid transition
} else {
  // unproven: log safely and require manual/provider confirmation
}
```

`SUCCESS`, `BERHASIL`, dan `DELIVERED` sengaja tidak ada pada daftar paid:
dua nilai pertama terlalu generik, sedangkan `DELIVERED` adalah vocabulary
pengiriman. Batasi batch cron, isolasi error per transaksi, dan jangan jadikan
perubahan payment sebagai trigger pengiriman otomatis.

## 10. Retry dan idempotensi

Gunakan prinsip berikut untuk endpoint yang membuat transaksi (`order`, `create_payment`, `submit`):

1. buat dan simpan `reff_id` sebelum request;
2. simpan state lokal `creating`;
3. jika response sukses, simpan `transaction_id`, `trx_id`, atau `awb` pada transaksi yang sama;
4. jika timeout/5xx, jangan otomatis membuat `reff_id` baru;
5. rekonsiliasi melalui `/advice` dengan provider transaction ID sebelum retry.

`reff_id` pada Create Resi didokumentasikan maksimal 30 digit dan tidak boleh sama pada hari yang sama. Aturan yang sama belum dipublikasikan secara eksplisit untuk Create Payment dan Create Order.

## 11. Callback

Kontrak callback AutoLaris belum memuat payload, signature, retry policy, atau source IP pada koleksi publik. Karena itu:

- jangan menandai order `PAID` hanya dari contoh payload buatan;
- simpan raw body dan selected headers sementara untuk discovery, dengan redaction data sensitif;
- balas sesuai kontrak vendor setelah format resmi diterima;
- implementasikan idempotensi dengan identifier resmi;
- verifikasi signature atau source network jika mekanismenya telah dikonfirmasi.

Sebelum production, minta AutoLaris memberi contoh callback nyata, daftar status final, aturan retry, dan cara verifikasi keaslian.

## 12. Checklist smoke test

- [ ] `GET /list_payment` mengembalikan `rc = "00"` dan channel akun.
- [ ] `POST /ongkir` mengembalikan minimal satu `service_detail` untuk area uji.
- [ ] `courir_id` dari ongkir diteruskan tanpa mapping manual yang stale.
- [ ] `reff_id`, `awb`, `transaction_id`, dan `trx_id` tersimpan sesuai flow.
- [ ] Logical error `rc !== "00"` tidak diproses sebagai sukses.
- [ ] `/advice` dipanggil dengan provider transaction ID, bukan `reff_id` lokal.
- [ ] `PENDING` dan `DELIVERED` tidak mengubah pembayaran menjadi paid.
- [ ] API Key tidak muncul pada browser bundle, response, atau log.
- [ ] Callback contract telah dikonfirmasi sebelum mengaktifkan status payment otomatis.
