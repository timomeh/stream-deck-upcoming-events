import streamDeck, { LogLevel } from '@elgato/streamdeck'

import { CalendarReminder } from './actions/calendar-reminder'

streamDeck.logger.setLevel(
  process.env.NODE_ENV === 'development' ? LogLevel.TRACE : LogLevel.WARN,
)

streamDeck.actions.registerAction(new CalendarReminder())

streamDeck.connect()
