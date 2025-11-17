import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import type { Internship, InternshipStatus } from "../types/internship";

const STATUS_OPTIONS: { value: InternshipStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "online_assessment", label: "Online Assessment" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

type StatusFilter = "all" | InternshipStatus;

const DashboardPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<InternshipStatus>("applied");
  const [notes, setNotes] = useState("");
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user) {
      setInternships([]);
      setLoadingList(false);
      return;
    }

    const colRef = collection(db, "users", user.uid, "internships");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot: any) => {
        const items: Internship[] = snapshot.docs.map((docSnap: any) => {
          const data = docSnap.data() as DocumentData;

          return {
            id: docSnap.id,
            company: data.company ?? "",
            role: data.role ?? "",
            status: (data.status as InternshipStatus) ?? "applied",
            notes: data.notes ?? "",
            createdAt: data.createdAt ?? null,
          };
        });

        setInternships(items);
        setLoadingList(false);
      },
      (err: any) => {
        console.error("Error loading internships:", err);
        setError("Failed to load internships. Check console for details.");
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const resetForm = () => {
    setCompany("");
    setRole("");
    setStatus("applied");
    setNotes("");
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!company.trim() || !role.trim()) {
      setError("Please enter both company and role.");
      return;
    }

    if (!user) {
      setError("You must be logged in to add or edit internships.");
      return;
    }

    setSaving(true);

    try {
      const colRef = collection(db, "users", user.uid, "internships");

      const trimmedNotes = notes.trim();

      if (isEditing && editingId) {
        const docRef = doc(db, "users", user.uid, "internships", editingId);
        await updateDoc(docRef, {
          company: company.trim(),
          role: role.trim(),
          status,
          notes: trimmedNotes,
        });
      } else {
        await addDoc(colRef, {
          company: company.trim(),
          role: role.trim(),
          status,
          notes: trimmedNotes,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (err) {
      console.error("Error saving internship:", err);
      setError("Failed to save internship. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Internship) => {
    setCompany(item.company);
    setRole(item.role);
    setStatus(item.status);
    setNotes(item.notes ?? "");
    setIsEditing(true);
    setEditingId(item.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    const confirmed = window.confirm("Delete this internship?");
    if (!confirmed) return;

    try {
      const docRef = doc(db, "users", user.uid, "internships", id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting internship:", err);
      setError("Failed to delete internship. Please try again.");
    }
  };

  // --- derived data for filters & summary + search ---
  const totalCount = internships.length;

  const statusCounts = STATUS_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.value] = internships.filter((i) => i.status === opt.value).length;
      return acc;
    },
    {} as Record<InternshipStatus, number>
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredInternships = internships.filter((item) => {
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    const haystack =
      (item.company + " " + item.role + " " + (item.notes ?? "")).toLowerCase();

    const matchesSearch =
      normalizedSearch === "" || haystack.includes(normalizedSearch);

    return matchesStatus && matchesSearch;
  });

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <p>You are not logged in.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        fontFamily: "sans-serif",
        backgroundColor: "#f3f4f6",
        overflowX: "hidden",
      }}
    >
      {/* Top bar full width */}
      <header
        style={{
          width: "100%",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#111827",
          color: "#f9fafb",
          boxSizing: "border-box",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Internship Tracker</h1>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af" }}>
            Signed in as {user.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #f87171",
            backgroundColor: "#b91c1c",
            color: "#fff",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </header>

      {/* Main full-width area */}
      <main
        style={{
          width: "100%",
          padding: "24px 32px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "1400px",
          }}
        >
          {/* Add / Edit internship card */}
          <section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "12px",
                fontSize: "1.1rem",
              }}
            >
              {isEditing ? "Edit Internship" : "Add Internship"}
            </h2>
            <form
              onSubmit={handleSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1.5fr 1fr auto",
                gap: "8px",
                alignItems: "center",
                maxWidth: "100%",
              }}
            >
              <div>
                <label
                  htmlFor="company"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Company
                </label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. DoorDash"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="role"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Role
                </label>
                <input
                  id="role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. SWE Intern"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as InternshipStatus)
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                    backgroundColor: "#fff",
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  alignItems: "flex-end",
                }}
              >
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "#fff",
                      color: "#374151",
                      fontWeight: 500,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: saving ? "#93c5fd" : "#2563eb",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: saving ? "default" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {saving ? "Saving..." : isEditing ? "Update" : "Add"}
                </button>
              </div>

              {/* Notes field (full width) */}
              <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                <label
                  htmlFor="notes"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about recruiter, next steps, links, interview dates, etc."
                  style={{
                    width: "100%",
                    minHeight: "60px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                    resize: "vertical",
                  }}
                />
              </div>
            </form>

            {error && (
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "0.85rem",
                  color: "#b91c1c",
                }}
              >
                {error}
              </p>
            )}
          </section>

          {/* List card */}
          <section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "12px",
                fontSize: "1.1rem",
              }}
            >
              Your Applications
            </h2>

            {/* Filter bar + search + summary */}
            <div
              style={{
                marginBottom: "12px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "9999px",
                    border:
                      statusFilter === "all"
                        ? "1px solid #2563eb"
                        : "1px solid #e5e7eb",
                    backgroundColor:
                      statusFilter === "all" ? "#eff6ff" : "#ffffff",
                    color: statusFilter === "all" ? "#1d4ed8" : "#374151",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  All ({totalCount})
                </button>

                {STATUS_OPTIONS.map((opt) => {
                  const count = statusCounts[opt.value] ?? 0;
                  const active = statusFilter === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "9999px",
                        border: active
                          ? "1px solid #2563eb"
                          : "1px solid #e5e7eb",
                        backgroundColor: active ? "#eff6ff" : "#ffffff",
                        color: active ? "#1d4ed8" : "#374151",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      {opt.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div>
                <input
                  type="text"
                  placeholder="Search by company, role, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "9999px",
                    border: "1px solid #e5e7eb",
                    fontSize: "0.8rem",
                    minWidth: "220px",
                  }}
                />
              </div>
            </div>

            {loadingList ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                Loading...
              </p>
            ) : filteredInternships.length === 0 ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                {totalCount === 0
                  ? "No internships yet. Add your first one above."
                  : "No internships match this filter/search."}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxWidth: "100%",
                }}
              >
                {filteredInternships.map((item) => {
                  let createdLabel = "";
                  if (item.createdAt && "toDate" in item.createdAt) {
                    createdLabel = item.createdAt
                      .toDate()
                      .toLocaleDateString();
                  }

                  const statusLabel =
                    STATUS_OPTIONS.find((s) => s.value === item.status)
                      ?.label ?? item.status;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: 600,
                            marginBottom: "2px",
                          }}
                        >
                          {item.company} — {item.role}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            marginBottom: item.notes ? "4px" : 0,
                          }}
                        >
                          {createdLabel && <>Added on {createdLabel} · </>}
                          Status: {statusLabel}
                        </div>
                        {item.notes && item.notes.trim() !== "" && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "#374151",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {item.notes}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          fontSize: "0.8rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #2563eb",
                            backgroundColor: "#eff6ff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #dc2626",
                            backgroundColor: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
