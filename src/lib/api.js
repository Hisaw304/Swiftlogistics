// src/lib/api.js
const API_BASE = "/api";

function getAdminKey() {
  try {
    return localStorage.getItem("adminKey");
  } catch {
    return null;
  }
}
function adminHeaders() {
  const key = getAdminKey();
  const h = { "Content-Type": "application/json" };
  if (key) h["x-admin-key"] = key;
  return h;
}
async function handleRes(res) {
  const text = await res.text().catch(() => "");
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json && json.error ? json.error : `HTTP ${res.status}`;
    const e = new Error(err);
    e.status = res.status;
    throw e;
  }
  return json;
}

export async function fetchRecords({ page = 1, limit = 200 } = {}) {
  const res = await fetch(
    `${API_BASE}/admin/records?page=${page}&limit=${limit}`,
    { headers: adminHeaders() }
  );
  return handleRes(res);
}

export async function createRecord(payload) {
  const res = await fetch(`${API_BASE}/admin/records`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateRecord(id, payload) {
  const res = await fetch(
    `${API_BASE}/admin/records/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleRes(res);
}

export async function nextStop(id) {
  const res = await fetch(
    `${API_BASE}/admin/records/${encodeURIComponent(id)}/next`,
    {
      method: "POST",
      headers: adminHeaders(),
    }
  );
  return handleRes(res);
}

export async function updateLocation(id, payload) {
  const res = await fetch(
    `${API_BASE}/admin/records/${encodeURIComponent(id)}/location`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleRes(res);
}

export async function fetchPublicTrack(trackingId) {
  const res = await fetch(
    `${API_BASE}/public/track?trackingId=${encodeURIComponent(trackingId)}`
  );
  return handleRes(res);
}

// optional: server-side signed upload helper
export async function requestUploadSignature() {
  const res = await fetch(`${API_BASE}/upload/sign`, {
    method: "GET",
    headers: adminHeaders(),
  });
  return handleRes(res);
}
