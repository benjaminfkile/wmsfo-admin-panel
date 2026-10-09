export function statusRoleLabel(role: string): string {
  switch (role) {
    case "no_event":
      return "No event";
    case "planned":
      return "Planned";
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    case "postponed":
      return "Postponed";
    default:
      return role;
  }
}
