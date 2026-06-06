import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Building2, 
  User, 
  Calendar, 
  Check, 
  X, 
  PlusCircle, 
  Search, 
  ChevronRight, 
  IndianRupee 
} from 'lucide-react';
import { Project, ProjectStatus, UserRole } from '../types';

interface ProjectManagerProps {
  projects: Project[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserName: string;
  onSaveProject: (project: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export default function ProjectManager({
  projects,
  currentUserRole,
  currentUserId,
  currentUserName,
  onSaveProject,
  onDeleteProject,
}: ProjectManagerProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [clientName, setClientName] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);

  const isAdmin = currentUserRole === UserRole.ADMIN;

  const handleEditClick = (p: Project) => {
    setEditingId(p.id);
    setProjectName(p.projectName);
    setSiteName(p.siteName);
    setClientName(p.clientName);
    setTotalBudget(p.totalBudget.toString());
    setStartDate(p.startDate);
    setExpectedEndDate(p.expectedEndDate);
    setStatus(p.status);
    setIsFormOpen(true);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setProjectName('');
    setSiteName('');
    setClientName('');
    setTotalBudget('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setExpectedEndDate('');
    setStatus(ProjectStatus.ACTIVE);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !siteName.trim() || !totalBudget) return;

    await onSaveProject({
      id: editingId || undefined,
      projectName,
      siteName,
      clientName,
      totalBudget: parseFloat(totalBudget) || 0,
      startDate,
      expectedEndDate,
      status,
    });

    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setProjectName('');
    setSiteName('');
    setClientName('');
    setTotalBudget('');
    setStartDate('');
    setExpectedEndDate('');
    setStatus(ProjectStatus.ACTIVE);
  };

  const filteredProjects = projects.filter(
    p =>
      !p.isDeleted &&
      (p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="project-manager-container" className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Project Sites Portfolio</h2>
          <p className="text-xs text-slate-400">Add, monitor and allocate operational budgets for your construction projects.</p>
        </div>

        {isAdmin && (
          <button
            id="register-project-btn"
            onClick={handleCreateClick}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
          >
            <PlusCircle className="w-4 h-4" /> Add Construct Site
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Form panel / info cards */}
        {isFormOpen && isAdmin && (
          <div id="project-upsert-card" className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingId ? 'Modify Site Specs' : 'Register New Construction Site'}
              </h3>
              <button
                id="cancel-upsert-btn"
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="pname-input" className="text-xs font-bold text-slate-500 uppercase">Project Name *</label>
                <input
                  id="pname-input"
                  type="text"
                  required
                  placeholder="e.g. Signature Residency"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="site-input" className="text-xs font-bold text-slate-500 uppercase">Site Name / Location *</label>
                <input
                  id="site-input"
                  type="text"
                  required
                  placeholder="e.g. Whitefield - Block A"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="client-input" className="text-xs font-bold text-slate-500 uppercase">Client Name</label>
                <input
                  id="client-input"
                  type="text"
                  placeholder="e.g. Mr. Nagesh Hegde"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="budget-input" className="text-xs font-bold text-slate-500 uppercase">Total Budget Allocated (INR) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                    ₹
                  </div>
                  <input
                    id="budget-input"
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 4500000"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="start-date-input" className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                  <input
                    id="start-date-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="end-date-input" className="text-xs font-bold text-slate-500 uppercase">Expected End</label>
                  <input
                    id="end-date-input"
                    type="date"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="status-select" className="text-xs font-bold text-slate-500 uppercase">Execution Status</label>
                <select
                  id="status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none bg-slate-50/50 text-slate-700"
                >
                  <option value={ProjectStatus.ACTIVE}>Active</option>
                  <option value={ProjectStatus.COMPLETED}>Completed</option>
                  <option value={ProjectStatus.ON_HOLD}>On Hold</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  id="save-project-btn"
                  type="submit"
                  className="flex-1 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                >
                  Submit Specs
                </button>
                <button
                  id="reset-form-btn"
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-xs transition-colors"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List of projects */}
        <div className={`space-y-4 ${isFormOpen && isAdmin ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          {/* List Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              id="project-search-input"
              type="text"
              placeholder="Search projects by site address, client names, or tag labels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm shadow-xs outline-none focus:border-emerald-500 placeholder-slate-400"
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 mx-auto stroke-[1.2] text-slate-300 mb-2" />
              No matching active construction projects found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((p) => {
                const isStatusActive = p.status === ProjectStatus.ACTIVE;
                const isStatusCompleted = p.status === ProjectStatus.COMPLETED;

                let statusColorClass = "bg-red-50 text-red-600 border-red-100";
                if (isStatusActive) statusColorClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
                if (isStatusCompleted) statusColorClass = "bg-sky-50 text-sky-600 border-sky-100";

                return (
                  <div
                    id={`project-card-${p.id}`}
                    key={p.id}
                    className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 transition-colors shadow-xs hover:shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    {/* Upper identity */}
                    <div className="space-y-1 pr-12">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md ${statusColorClass}`}>
                          {p.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{p.id.toUpperCase()}</span>
                      </div>
                      <h4 className="font-black text-slate-800 text-base tracking-tight">{p.projectName}</h4>
                      <p className="text-xs text-slate-500 leading-snug font-medium">{p.siteName}</p>
                    </div>

                    {/* Quick Specs */}
                    <div className="space-y-2 border-t border-b border-slate-50 py-3 text-xs font-semibold text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Client</span>
                        <span className="text-slate-800">{p.clientName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Timeline</span>
                        <span className="text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                          {p.startDate} ~ {p.expectedEndDate || 'Open'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Budget</span>
                        <span className="text-emerald-700 font-bold flex items-center">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {p.totalBudget.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Operational triggers */}
                    {isAdmin && (
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          id={`edit-project-btn-${p.id}`}
                          onClick={() => handleEditClick(p)}
                          className="p-2 border border-slate-100 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                          title="Edit specs"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          id={`delete-project-btn-${p.id}`}
                          onClick={() => {
                            if (window.confirm(`Are you absolutely sure you want to soft delete the construction project "${p.projectName}"? All transactional records will remain in database but hidden from active lists.`)) {
                              onDeleteProject(p.id);
                            }
                          }}
                          className="p-2 border border-slate-100 text-slate-500 hover:text-red-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                          title="Archive project (Soft Delete)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
