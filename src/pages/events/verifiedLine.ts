// The line above the email quota notice wherever an alert is about to go out,
// from the subscribers summary's verified count.
export function verifiedLine(verified: number | undefined): string {
  return verified === undefined
    ? "Verified subscribers will be emailed"
    : `${verified} verified subscribers will be emailed`;
}
