function TicketFilters({
    search,
    status,
    priority,
    onSearchChange,
    onStatusChange,
    onPriorityChange,
    onApply,
    onClear
}) {
    return (
        <div className="ticket-filters">

            <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
            />

            <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
            >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_user">
                    Waiting on User
                </option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
            </select>

            <select
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value)}
            >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
            </select>

            <button onClick={onApply}>
                Apply Filters
            </button>

            <button onClick={onClear}>
                Clear
            </button>

        </div>
    );
}

export default TicketFilters;