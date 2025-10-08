import React, { useEffect, useState } from "react";
import AdminForm from "../components/AdminForm";
import RecordsTable from "../components/RecordsTable";
import TrackingModal from "../components/TrackingModal";

function normalizeId(id) {
  if (!id) return null;
  if (typeof id === "object" && typeof id.toString === "function")
    return id.toString();
  return String(id);
}

export default function AdminPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("adminKey") || "" : ""
  );
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (adminKey) loadRecords();
    else setRecords([]);
  }, [adminKey]);

  function saveAdminKey(key) {
    try {
      localStorage.setItem("adminKey", key);
    } catch {}
    setAdminKey(key);
  }

  // central fetch that always attaches adminKey from state
  async function apiFetch(path, opts = {}) {
    const headers = (opts.headers = opts.headers || {});
    headers["x-admin-key"] = adminKey || "";
    if (!headers["Content-Type"] && opts.body) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, { cache: "no-store", ...opts });
    return res;
  }

  async function fetchRecordsWithKey({ page = 1, limit = 200 } = {}) {
    const q = `?page=${page}&limit=${limit}`;
    const res = await apiFetch(`/api/admin/records${q}`, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function createRecordWithKey(payload) {
    const res = await apiFetch(`/api/admin/records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function updateRecordWithKey(id, payload) {
    const idStr = normalizeId(id);
    if (!idStr) throw new Error("Missing record id");

    // Debug: log outgoing request on client
    console.log("▶️ updateRecordWithKey ->", { id: idStr, payload });

    const res = await apiFetch(
      `/api/admin/records/${encodeURIComponent(idStr)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );

    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `HTTP ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(
        body?.error || JSON.stringify(body) || `HTTP ${res.status}`
      );
    }

    if (body && body._id && typeof body._id !== "string") {
      body._id = body._id.toString();
    }
    return body;
  }

  async function nextStopWithKey(id) {
    const idStr = normalizeId(id);
    if (!idStr) throw new Error("Missing record id");
    const res = await apiFetch(
      `/api/admin/records/${encodeURIComponent(idStr)}/next`,
      {
        method: "POST",
      }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function deleteRecordById(id) {
    if (!confirm("Delete this record?")) return;
    const idStr = normalizeId(id);
    if (!idStr) {
      alert("Missing id");
      return;
    }
    const res = await apiFetch(
      `/api/admin/records/${encodeURIComponent(idStr)}`,
      {
        method: "DELETE",
      }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (body && (body.error || JSON.stringify(body))) || `HTTP ${res.status}`
      );
    }
    // refresh
    await loadRecords();
  }

  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchRecordsWithKey();
      setRecords(
        Array.isArray(json.items) ? json.items : json.items || json || []
      );
    } catch (err) {
      setError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload) {
    const created = await createRecordWithKey(payload);
    const createdSafe = { ...created, _id: normalizeId(created._id) };
    setRecords((s) => [createdSafe, ...s]);
    return created;
  }

  async function handleUpdate(idOrTrackingId, payload) {
    const updated = await updateRecordWithKey(idOrTrackingId, payload);
    const updatedIdStr = normalizeId(updated._id);
    const updatedTrackingId = updated.trackingId;

    setRecords((s) =>
      s.map((r) =>
        normalizeId(r._id) === updatedIdStr ||
        r.trackingId === updatedTrackingId
          ? updated
          : r
      )
    );
    setEditing(null);
    return updated;
  }

  async function handleNext(idOrTrackingId) {
    const updated = await nextStopWithKey(idOrTrackingId);
    const updatedIdStr = normalizeId(updated._id);
    const updatedTrackingId = updated.trackingId;

    setRecords((s) =>
      s.map((r) =>
        normalizeId(r._id) === updatedIdStr ||
        r.trackingId === updatedTrackingId
          ? updated
          : r
      )
    );
    return updated;
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Admin Panel — Tracking Records
      </h1>

      <div className="mb-6">
        <label className="text-sm text-gray-600 font-medium">
          Type your Admin Key below
        </label>
        <div className="flex gap-2 mt-2">
          <input
            className="p-2 border rounded flex-1"
            placeholder="Enter your ADMIN_KEY"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => saveAdminKey(adminKey)}
          >
            Save
          </button>
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
            onClick={() => {
              try {
                localStorage.removeItem("adminKey");
              } catch {}
              setAdminKey("");
              setRecords([]);
            }}
          >
            Clear
          </button>
          <button
            className="px-4 py-2 bg-gray-100 rounded text-sm"
            onClick={loadRecords}
            disabled={!adminKey}
          >
            Refresh
          </button>
        </div>
        {!adminKey && (
          <p className="text-xs text-red-600 mt-2">
            ⚠️ Please enter your admin key to access records.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">
            Create a New Record
          </h2>
          <AdminForm onCreate={handleCreate} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700">All Records</h2>
            <button
              className="px-4 py-2 bg-gray-100 rounded text-sm"
              onClick={loadRecords}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500 text-center">
              Loading records…
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>
          ) : (
            <RecordsTable
              records={records}
              onNext={handleNext}
              onEdit={(r) =>
                setEditing({
                  ...r,
                  // ensure editing always has a string id available:
                  trackingId:
                    r.trackingId ?? (r._id ? String(r._id) : undefined),
                })
              }
              onView={(r) => setViewing(r)}
              onDelete={deleteRecordById}
            />
          )}
        </div>
      </div>

      {viewing && (
        <TrackingModal record={viewing} onClose={() => setViewing(null)} />
      )}

      {editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">
                Edit Record — {editing.trackingId ?? normalizeId(editing._id)}
              </h3>
              <button
                className="text-sm text-gray-600"
                onClick={() => setEditing(null)}
              >
                ✕ Close
              </button>
            </div>
            <AdminForm
              mode="edit"
              initial={editing}
              onUpdate={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
