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
  // central fetch that always attaches adminKey from localStorage (reliably)
  // central fetch that always attaches adminKey from localStorage (reliably)
  async function apiFetch(path, opts = {}) {
    const headers = (opts.headers = opts.headers || {});
    // ALWAYS read from localStorage to avoid stale closure values
    const key =
      typeof window !== "undefined"
        ? localStorage.getItem("adminKey") || ""
        : adminKey || "";
    if (key) headers["x-admin-key"] = key;
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
    const idStr = String(id);
    const adminKey =
      typeof window !== "undefined" ? localStorage.getItem("adminKey") : null;
    if (!adminKey) throw new Error("Missing admin key");

    const res = await fetch(`/api/admin/records/${idStr}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let bodyJson = null;
    try {
      bodyJson = await res.json();
    } catch (e) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `HTTP ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(
        bodyJson?.error || JSON.stringify(bodyJson) || `HTTP ${res.status}`
      );
    }

    // server returns { updatedRecord: { ... } } or the doc itself
    const updated = bodyJson.updatedRecord || bodyJson;

    if (updated && updated._id && typeof updated._id !== "string") {
      try {
        updated._id = updated._id.toString();
      } catch {}
    }

    if (!updated || (!updated.trackingId && !updated._id)) {
      await loadRecords();
      throw new Error(
        "Update completed but server didn't return updated record; reloaded list."
      );
    }

    return updated;
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

    // optimistic removal so UI is responsive even if server reply is delayed
    setRecords((prev) =>
      prev.filter((r) => normalizeId(r._id) !== idStr && r.trackingId !== idStr)
    );

    try {
      const res = await apiFetch(
        `/api/admin/records/${encodeURIComponent(idStr)}`,
        {
          method: "DELETE",
        }
      );

      // server returns JSON; but handle if it doesn't
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // if deletion failed, reload list to re-sync UI and surface error
        await loadRecords().catch(() => {});
        throw new Error(
          (body && (body.error || JSON.stringify(body))) || `HTTP ${res.status}`
        );
      }

      // success — ensure UI is in sync
      await loadRecords();
    } catch (err) {
      console.error("Delete failed:", err);
    }
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
    try {
      const updated = await updateRecordWithKey(idOrTrackingId, payload);

      const updatedIdStr = normalizeId(updated._id);
      const updatedTrackingId = updated.trackingId;

      setRecords((s) =>
        s.map((r) => {
          const rIdStr = normalizeId(r._id);
          return rIdStr === updatedIdStr || r.trackingId === updatedTrackingId
            ? { ...r, ...updated } // merge to preserve any fields the UI had
            : r;
        })
      );

      setEditing(null);
      return updated;
    } catch (err) {
      console.error("Update failed (handleUpdate):", err);
      // fallback: reload records so UI reflects DB
      try {
        await loadRecords();
      } catch {}
      setEditing(null);
      throw err;
    }
  }

  async function handleNext(idOrTrackingId) {
    try {
      console.log("🧭 handleNext called with:", idOrTrackingId);

      const record = records.find(
        (r) =>
          r.trackingId === idOrTrackingId ||
          String(r._id) === String(idOrTrackingId)
      );
      if (!record) throw new Error("Record not found locally");

      console.log("✅ Found record:", record.trackingId, record._id);

      const adminKey =
        typeof window !== "undefined" ? localStorage.getItem("adminKey") : null;
      if (!adminKey) throw new Error("Missing admin key");

      // 🧠 Instead of PATCH, we now POST to the specific "next" endpoint
      const res = await fetch(`/api/admin/records/${record.trackingId}/next`, {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
        },
      });

      const text = await res.text().catch(() => "");
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }

      if (!res.ok) {
        console.error("Server responded non-ok:", res.status, body);
        throw new Error(
          body?.error || JSON.stringify(body) || `HTTP ${res.status}`
        );
      }

      const updated = body.updatedRecord || body;
      if (updated && updated._id && typeof updated._id !== "string") {
        try {
          updated._id = updated._id.toString();
        } catch {}
      }

      setRecords((prev) =>
        prev.map((r) =>
          String(r._id) === String(updated._id) ||
          (r.trackingId &&
            updated.trackingId &&
            r.trackingId === updated.trackingId)
            ? { ...r, ...updated }
            : r
        )
      );

      console.log("✅ moved to next checkpoint:", updated);
      return updated;
    } catch (err) {
      console.error("❌ Update failed (handleNext):", err);
      return null;
    }
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
            <h2 className="text-lg font-semibold text-gray-700">Records</h2>
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
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditing(null)}
        >
          {/* container aligns to start so modal sits lower and can expand; add padding-top */}
          <div
            className="min-h-screen flex items-start justify-center pt-10 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-2xl bg-white rounded-lg shadow p-4"
              style={{ maxHeight: "85vh", overflow: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">
                  Edit Record — {editing.trackingId ?? normalizeId(editing._id)}
                </h3>
                <button
                  className="text-sm text-gray-600"
                  onClick={() => setEditing(null)}
                  aria-label="Close edit modal"
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
        </div>
      )}
    </div>
  );
}
