export function formatTimeAgo(minutes: number): string {
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / (24 * 60))}d ago`;
}