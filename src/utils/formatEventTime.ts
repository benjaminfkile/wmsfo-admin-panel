const FORCED_TIMEZONE = process.env.REACT_APP_FORCED_TIMEZONE;
const FORCED_TIME_ABBR = process.env.REACT_APP_FORCED_TIME_ABBR;

function formatEventTime(iso: string) {
  const d = new Date(iso);

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };

  if (FORCED_TIMEZONE) {
    options.timeZone = FORCED_TIMEZONE;
  }

  return (
    d.toLocaleString("en-US", options) +
    (FORCED_TIME_ABBR ? ` ${FORCED_TIME_ABBR}` : "")
  );
}

export default formatEventTime
