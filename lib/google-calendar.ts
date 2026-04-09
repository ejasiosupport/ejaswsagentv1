import { google } from "googleapis";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const SLOT_DURATION_MINUTES = 60;
const BUSINESS_HOURS = { start: 9, end: 18 }; // 9am–6pm

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

// Get available slots for a given date (YYYY-MM-DD)
export async function getAvailableSlots(date: string): Promise<string[]> {
  const calendar = getCalendarClient();

  const dayStart = new Date(`${date}T${String(BUSINESS_HOURS.start).padStart(2, "0")}:00:00+08:00`);
  const dayEnd = new Date(`${date}T${String(BUSINESS_HOURS.end).padStart(2, "0")}:00:00+08:00`);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = data.calendars?.[CALENDAR_ID]?.busy ?? [];

  // Generate all hourly slots
  const slots: string[] = [];
  const current = new Date(dayStart);
  while (current < dayEnd) {
    const slotEnd = new Date(current.getTime() + SLOT_DURATION_MINUTES * 60000);
    const isbusy = busy.some((b) => {
      const bStart = new Date(b.start!);
      const bEnd = new Date(b.end!);
      return current < bEnd && slotEnd > bStart;
    });
    if (!isbusy) {
      slots.push(
        current.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" })
      );
    }
    current.setMinutes(current.getMinutes() + SLOT_DURATION_MINUTES);
  }

  return slots;
}

// Book an appointment
export async function bookAppointment(params: {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  guestName: string;
  guestPhone: string;
  type: "consultation" | "demo";
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = getCalendarClient();

    const start = new Date(`${params.date}T${params.time}:00+08:00`);
    const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60000);

    const { data } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `${params.type === "demo" ? "Demo" : "Consultation"} — ${params.guestName}`,
        description: `Booked via WhatsApp\nName: ${params.guestName}\nPhone: ${params.guestPhone}`,
        start: { dateTime: start.toISOString(), timeZone: "Asia/Kuala_Lumpur" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Kuala_Lumpur" },
      },
    });

    return { success: true, eventId: data.id ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
