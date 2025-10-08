// src/pages/AdminPage.jsx  (or wherever AdminPage lives) — replace with this full file
import React, { useEffect, useState } from "react";
import AdminForm from "../components/AdminForm";
import RecordsTable from "../components/RecordsTable";
import TrackingModal from "../components/TrackingModal";

// helper: normalize ObjectId or string to a string
function normalizeId(id) {
  if (id == null) return String(id);
  try {
    return typeof id === "object" && typeof id.toString === "function"
      ? id.toString()
      : String(id);
  } catch {
    return String(id);
  }
}

export default function AdminPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem("adminKey") || "";
    } catch {
      return "";
    }
  });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState(null);

  // load records when adminKey changes (or on demand)
  useEffect(() => {
    if (adminKey) {
      loadRecords();
    } else {
      setRecords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  function saveAdminKey(key) {
    try {
      localStorage.setItem("adminKey", key);
    } catch {}
    setAdminKey(key);
  }

  // ---------- API helpers that always include adminKey ----------
  async function apiFetch(path, opts = {}) {
    const headers = (opts.headers = opts.headers || {});
    headers["x-admin-key"] = adminKey || "";
    if (!headers["Content-Type"] && opts.body)
      headers["Content-Type"] = "application/json";
    // enforce fresh fetches for admin endpoints
    const res = await fetch(path, { cache: "no-store", ...opts });
    return res;
  }

  async function fetchRecordsWithKey({ page = 1, limit = 200 } = {}) {
    const q = `?page=${page}&limit=${limit}`;
    const res = await apiFetch(`/api/admin/records${q}`, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => null);
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function createRecordWithKey(payload) {
    const res = await apiFetch(`/api/admin/records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => null);
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function updateRecordWithKey(id, payload) {
    const idStr = String(id); // ✅ always use trackingId directly
    const adminKey =
      typeof window !== "undefined" ? localStorage.getItem("adminKey") : null;
    if (!adminKey) throw new Error("Missing admin key");

    const res = await fetch(`/api/admin/records/${encodeURIComponent(idStr)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

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
    // if you have a separate endpoint for next stop, adapt the path; fallback to PATCH-like behavior:
    const res = await apiFetch(
      `/api/admin/records/${encodeURIComponent(idStr)}/next`,
      {
        method: "POST",
      }
    );
    // If your API doesn't have /next POST, you might call a PATCH — adjust accordingly.
    if (!res.ok) {
      const body = await res.text().catch(() => null);
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ---------- UI-level helpers ----------
  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchRecordsWithKey({ limit: 200 });
      setRecords(Array.isArray(json.items) ? json.items : json.items || []);
    } catch (err) {
      setError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload) {
    const created = await createRecordWithKey(payload);
    // normalize created._id
    const createdSafe = { ...created, _id: normalizeId(created._id) };
    setRecords((s) => [createdSafe, ...s]);
    return created;
  }

  async function handleUpdate(idOrTrackingId, payload) {
    const updated = await updateRecordWithKey(idOrTrackingId, payload);

    const updatedIdStr = normalizeId(updated._id);
    const updatedTrackingId = updated.trackingId;

    setRecords((s) =>
      s.map((r) => {
        const rIdStr = normalizeId(r._id);
        return rIdStr === updatedIdStr || r.trackingId === updatedTrackingId
          ? updated
          : r;
      })
    );

    setEditing(null);
    return updated;
  }
  async function deleteRecordById(id) {
    if (!confirm("Delete this record?")) return;
    const idStr = normalizeId(id);
    if (!adminKey) {
      alert("Missing admin key");
      return;
    }

    // helper to call delete and return parsed body
    async function callDelete(idToDelete) {
      const res = await fetch(
        `/api/admin/records/${encodeURIComponent(idToDelete)}`,
        {
          method: "DELETE",
          headers: { "x-admin-key": adminKey },
          cache: "no-store",
        }
      );
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        body = null;
      }
      return { res, body };
    }

    try {
      console.log("Deleting id:", idStr);
      const { res, body } = await callDelete(idStr);

      if (!res.ok) {
        throw new Error(
          (body && (body.error || JSON.stringify(body))) || `HTTP ${res.status}`
        );
      }

      // If deletedCount reported 1 => success
      if (
        body &&
        typeof body.deletedCount !== "undefined" &&
        body.deletedCount > 0
      ) {
        await loadRecords(); // refresh list
        return;
      }

      // deletedCount is 0 (or server didn't provide it). Try fallback id from current records:
      console.warn("Server reported deletedCount 0, attempting fallback id...");

      // Find the record in current records to get its alternate id
      const found = records.find(
        (r) => normalizeId(r._id) === idStr || r.trackingId === idStr
      );
      const altId = found
        ? normalizeId(found._id) === idStr
          ? found.trackingId
          : normalizeId(found._id)
        : null;

      if (altId) {
        console.log("Trying fallback delete id:", altId);
        const { res: res2, body: body2 } = await callDelete(altId);
        if (!res2.ok) {
          throw new Error(
            (body2 && (body2.error || JSON.stringify(body2))) ||
              `HTTP ${res2.status}`
          );
        }
        if (
          body2 &&
          typeof body2.deletedCount !== "undefined" &&
          body2.deletedCount > 0
        ) {
          await loadRecords();
          return;
        }
      }

      // If we get here no deletion happened
      await loadRecords(); // resync
      throw new Error("Delete did not remove any document.");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err.message || "unknown"));
    }
  }

  async function handleNext(idOrTrackingId) {
    try {
      const updated = await nextStopWithKey(idOrTrackingId);

      const updatedIdStr = normalizeId(updated._id);
      const updatedTrackingId = updated.trackingId;

      setRecords((s) =>
        s.map((r) => {
          const rIdStr = normalizeId(r._id);
          return rIdStr === updatedIdStr || r.trackingId === updatedTrackingId
            ? updated
            : r;
        })
      );

      return updated;
    } catch (err) {
      alert(err.message || "Failed to advance.");
    }
  }

  // render
  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Admin Panel — Tracking Records
      </h1>

      {/* Admin key section */}
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
              localStorage.removeItem("adminKey");
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

      {/* Content grid */}
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
              onEdit={(r) => setEditing(r)}
              onView={(r) => setViewing(r)}
              onDelete={deleteRecordById}
            />
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewing && (
        <TrackingModal record={viewing} onClose={() => setViewing(null)} />
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">
                Edit Record — {editing.trackingId}
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
