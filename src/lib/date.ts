/**
 *
 * @param date the Data() to be formated
 * @returns formated data
 */
export function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}

/**
 *
 * @param currentDate get the current data of now
 * @param currentDataString get the current data and remove the / from the format
 */
export const currentDate: string = formatDateTime(new Date());
export const currentDateString: string = currentDate.replace(/\D/g, "");

/**
 * @returns Local Data Formate "2024/5/31, 1:44:7 AM"
 */
function getLocalFormattedDate() {
  const now = new Date();
  const options: any = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  };
  return now.toLocaleString("en-US", options);
}

/**
 * @returns Local Data Formate "2024/5/31, 1:44:7 AM"
 */
export const currentLocalDate = getLocalFormattedDate();
