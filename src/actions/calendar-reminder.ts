import {
  action,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  streamDeck,
} from '@elgato/streamdeck'
import { runAppleScript } from 'run-applescript'
import { removeEmojis } from '../utils/removeEmojis'

type ReminderSettings = {
  wakeBeforeMins?: number
  sleepAfterMins?: number
}

type CalEvent = {
  title: string
  date: Date
  url: string | null
}

@action({ UUID: 'de.timomeh.upcoming-events.calendar-reminder' })
export class CalendarReminder extends SingletonAction<ReminderSettings> {
  private timerId: NodeJS.Timeout = 0 as unknown as NodeJS.Timeout
  private event: CalEvent | null = null
  private didInitialize = false

  override async onWillAppear(
    ev: WillAppearEvent<ReminderSettings>,
  ): Promise<void> {
    // only works on keys
    if (!ev.action.isKey()) return

    // restore cached event
    if (this.event) {
      ev.action.setImage(this.svg(this.event))
    } else if (this.didInitialize) {
      ev.action.setState(1)
    }

    this.didInitialize = true

    // check next event and update button
    const event = await this.checkCalendar(ev.payload.settings)
    this.event = event
    if (!event) {
      ev.action.setImage('')
      ev.action.setState(1)
    } else {
      ev.action.setImage(this.svg(event))
    }

    // poll for next event and update button
    this.timerId = setInterval(async () => {
      const event = await this.checkCalendar(ev.payload.settings)
      this.event = event
      if (!event) {
        ev.action.setImage('')
        // @ts-expect-error
        ev.action.setState(1)
      } else {
        ev.action.setImage(this.svg(event))
      }
    }, 30_000)
  }

  override onWillDisappear(): Promise<void> | void {
    // stop polling when button is not visible
    clearInterval(this.timerId)
  }

  override async onKeyUp(ev: KeyUpEvent<ReminderSettings>): Promise<void> {
    // Keep the current state visible
    ev.action.setState(ev.payload.state ?? 0)

    // open the current event
    if (this.event?.url) {
      await streamDeck.system.openUrl(this.event.url)
      await ev.action.showOk()
      return
    }

    // recheck when there's no current event
    if (!this.event) {
      const event = await this.checkCalendar(ev.payload.settings)
      this.event = event
      if (!event) {
        ev.action.setImage('')
        ev.action.setState(1)
      } else {
        ev.action.setImage(this.svg(event))
      }
    }
  }

  // draw an svg with the next event
  private svg(event: CalEvent) {
    const timeString = event.date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-size="21" fill="white" font-weight="bold">
    ${timeString}
  </text>
  <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="white">
    ${removeEmojis(event.title)}
  </text>
</svg>`

    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`

    return uri
  }

  // check calendar event with AppleScriptObjC
  private async checkCalendar(settings: ReminderSettings) {
    const after = settings.sleepAfterMins ?? 10
    const before = settings.wakeBeforeMins ?? 10

    // thanks chatgpt, it was horrible to create this applescript with you.
    // what even is this language lol
    const res = await runAppleScript(`use AppleScript version "2.4"
use scripting additions
use framework "Foundation"
use framework "EventKit"

-- create current date
set nowDate to current application's NSDate's |date|()

-- calculate start date for 10 minutes before and after the current time
set startTime to nowDate's dateByAddingTimeInterval:-(${before} * 60)
set endTime to nowDate's dateByAddingTimeInterval:(${after} * 60)

-- gain access to Event Kit
set theEKEventStore to create_event_store_access()

-- if no access is allowed to Event Kit, then exit script
if theEKEventStore is false then return

-- refresh the calendars to ensure data is up-to-date
theEKEventStore's refreshSourcesIfNecessary()

-- get calendars that can store events
set theCalendars to theEKEventStore's calendarsForEntityType:0

-- find all events across calendars
set thePred to theEKEventStore's predicateForEventsWithStartDate:startTime endDate:endTime calendars:theCalendars
set theEvents to (theEKEventStore's eventsMatchingPredicate:thePred)

-- filter for events starting exactly within the 10-minute window
set filteredEvents to current application's NSMutableArray's array()
repeat with anEvent in theEvents
  set eventStartDate to anEvent's startDate()
  if (eventStartDate's timeIntervalSinceDate:nowDate) is less than or equal to (${after} * 60) and (eventStartDate's timeIntervalSinceDate:nowDate) is greater than or equal to -(${before} * 60) then
    filteredEvents's addObject:anEvent
  end if
end repeat

-- sort by start date
set sortedEvents to filteredEvents's sortedArrayUsingSelector:"compareStartDateWithEvent:"

-- return details of the first matching event
if (count of sortedEvents) > 0 then
  set firstEvent to first item of sortedEvents
  set eventTitle to (firstEvent's title()) as text

  -- Convert NSDate to a readable format
  set dateFormatter to current application's NSDateFormatter's alloc()'s init()
  dateFormatter's setDateFormat:"yyyy-MM-dd'T'HH:mm:ssZZZZZ"
  set eventStartDate to dateFormatter's stringFromDate:(firstEvent's startDate())

  -- Check for URL in event notes (hopefully the first url is a video call link)
  set theNotes to (firstEvent's notes()) as text
  set urlPattern to "(https?://[a-zA-Z0-9./?&_=-]+)"
  set regex to current application's NSRegularExpression's regularExpressionWithPattern:urlPattern options:0 |error|:(missing value)
  set match to regex's firstMatchInString:theNotes options:0 range:{0, length of theNotes}
  if match is missing value then
  set eventURL to "_CAL_NULL"
  else
  set urlRange to match's range()
  set nsNotes to current application's NSString's stringWithString:theNotes
  set eventURL to (nsNotes's substringWithRange:urlRange) as text
  end if

  return "_CAL_DATA: " & eventTitle & linefeed & "_CAL_DATA: " & eventStartDate & linefeed & "_CAL_DATA: " & eventURL
else
  return "_CAL_NO_EVENTS"
end if

-- subroutine to gain access to Event Kit
on create_event_store_access()
  set theEKEventStore to current application's EKEventStore's alloc()'s init()
  theEKEventStore's requestAccessToEntityType:0 completion:(missing value)
  set authorizationStatus to current application's EKEventStore's authorizationStatusForEntityType:0
  if authorizationStatus is not 3 then
  display dialog "Access must be given in System Preferences" & linefeed & "-> Security & Privacy first." buttons {"OK"} default button 1
  tell application "System Preferences"
  activate
  tell pane id "com.apple.preference.security" to reveal anchor "Privacy"
  end tell
  error number -128
  return false
  else
  return theEKEventStore
  end if
end create_event_store_access
`)
    if (res === '_CAL_NO_EVENTS') {
      return null
    }

    // parse the string returned from applescript
    const [_, title, time, url] = res
      .split('_CAL_DATA: ')
      .map((v) => v.trim())
      .map((v) => (v === '_CAL_NULL' ? null : v))

    return {
      title: title!,
      date: new Date(time ?? new Date()),
      url,
    } satisfies CalEvent
  }
}
