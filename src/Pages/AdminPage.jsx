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
    // id may be trackingId or an _id string. Use string form.
    const idStr = String(id);
    const adminKey =
      typeof window !== "undefined" ? localStorage.getItem("adminKey") : null;
    if (!adminKey) throw new Error("Missing admin key");

    // Use the index PATCH signature your server currently handles:
    // { trackingId, updates }
    const body = JSON.stringify({ trackingId: idStr, updates: payload });

    const res = await fetch(`/api/admin/records`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body,
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
      // if server returned helpful error, surface it
      throw new Error(
        bodyJson?.error || JSON.stringify(bodyJson) || `HTTP ${res.status}`
      );
    }

    // server should return the updated document in bodyJson.updatedRecord OR the doc directly
    const updated = bodyJson.updatedRecord || bodyJson;

    // normalize _id if it's an object
    if (updated && updated._id && typeof updated._id !== "string") {
      try {
        updated._id = updated._id.toString();
      } catch {}
    }

    // if the server didn't return a doc, fallback: reload records list (safe)
    if (!updated || (!updated.trackingId && !updated._id)) {
      // best-effort resync
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

      // Try /next endpoint first (preferred) — swallow 404s and try fallback
      const idForRoute = encodeURIComponent(
        record.trackingId || String(record._id)
      );
      let nextRes;
      try {
        nextRes = await fetch(`/api/admin/records/${idForRoute}/next`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          cache: "no-store",
        });
      } catch (err) {
        // network failure; treat like a non-ok response so fallback will run
        console.warn(
          "Network error calling /next, will try PATCH fallback",
          err
        );
        nextRes = null;
      }

      if (nextRes && nextRes.ok) {
        const body = await nextRes.json().catch(() => null);
        const updated = body;
        // robust updater: match by _id or trackingId
        setRecords((prev) =>
          prev.map((r) =>
            String(r._id) === String(updated._id) ||
            (r.trackingId &&
              updated.trackingId &&
              r.trackingId === updated.trackingId)
              ? updated
              : r
          )
        );
        console.log("✅ moved to next (via /next):", updated);
        return updated;
      }

      // If /next returned 404 or other non-ok, *don't* throw immediately — try PATCH fallback
      if (nextRes && !nextRes.ok) {
        // only log at debug level since fallback will handle it
        console.debug(
          "Server /next responded non-ok:",
          nextRes.status,
          await nextRes.text().catch(() => "[non-json]")
        );
      }

      // Fallback: PATCH collection endpoint (update currentIndex)
      const nextIndex = (record.currentIndex ?? 0) + 1;
      const patchRes = await fetch("/api/admin/records", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          // prefer trackingId (server code supports query by ObjectId as fallback)
          trackingId: record.trackingId || String(record._id),
          updates: { currentIndex: nextIndex },
        }),
        cache: "no-store",
      });

      const text = await patchRes.text().catch(() => "");
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }

      if (!patchRes.ok) {
        // now this is a real problem — both endpoints failed
        console.error("Server PATCH responded non-ok:", patchRes.status, body);
        throw new Error(
          body?.error || JSON.stringify(body) || `HTTP ${patchRes.status}`
        );
      }

      const updated = body.updatedRecord || body;
      setRecords((prev) =>
        prev.map((r) =>
          String(r._id) === String(updated._id) ||
          (r.trackingId &&
            updated.trackingId &&
            r.trackingId === updated.trackingId)
            ? updated
            : r
        )
      );

      console.log("✅ moved to next (via PATCH):", updated);
      return updated;
    } catch (err) {
      // Only alert / console.error when *both* attempts fail.
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
