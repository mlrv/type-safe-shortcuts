import { Accelerator, Modifier, NonModifier, NormalizedModifier, RegisterOptions } from "./keys"
import { BrowserWindow, Input, Event, app } from "electron"
import { constVoid } from "./utils"
import { InputProperty, inputProperties } from "./input"

// Given a valid accelerator string, split it into
// its `Modifier`s and `NonModifier`s components
const split = <S extends string>(
  accelerator: Accelerator<S>
): [Modifier[], NonModifier[]] => {
  const components = accelerator.split("+")

  const modifiers = components.filter(
    (c): c is Modifier => isModifier(c)
  )

  const rest = components.filter(
    (c): c is NonModifier => !isModifier(c) // something better?
  )

  return [modifiers, rest]
}

// `Modifier` type guard
const isModifier = (
  str: string
): str is Modifier => [
  "Command",
  "Cmd",
  "Control",
  "Ctrl",
  "CommandOrControl",
  "CmdOrCtrl",
  "Alt",
  "Option",
  "AltGr",
  "Shift",
  "Super"
].includes(str)

// Normalize a `Modifier` key to a common subset
const normalizeModifier = (
  modifier: Modifier
): NormalizedModifier => {
  switch (modifier) { // Verify
    case "Cmd":
    case "Command":
    case "CmdOrCtrl":
    case "CommandOrControl":
      return "Cmd"

    case "Alt":
    case "Option":
      return "Alt"

    case "Control":
    case "Ctrl":
      return "Ctrl"

    default:
      return modifier
  }
}

// Given a list of `Modifier`s, return its normalised subset
const normalizeModifiers = (
  modifiers: Modifier[]
): NormalizedModifier[] => [
  ...new Set(modifiers.map(normalizeModifier)) // see if I want to keep this
]

// Given a `NormalizedModifier`, map it to the corresponding
// input property of an Electron Input event
const normalizedModifierToInputProperty = (
  normalizedModifier: NormalizedModifier
): InputProperty => {
  switch (normalizedModifier) {
    case "Super": // could do this earlier
    case "Cmd":
      return "meta"
    case "Ctrl":
    case "AltGr":
      return "control"
    case "Shift":
      return "shift"
    case "Alt":
      return "alt"
  }
}

// Register a shortcut for the given accelerator string
export const register = <S extends string>(
  accelerator: Accelerator<S>,
  f: () => void,
  options?: RegisterOptions,
  window?: BrowserWindow,
): void => {
  // `stict` is false if not specified
  const strictOpt = options?.strict || false

  // If no window is specified, enable shortcut for all
  // existing windows and future ones
  const { windows, enableForNew } = window
    ? { windows: [ window ], enableForNew: false }
    : {
      windows: BrowserWindow.getAllWindows(),
      enableForNew: true
    }

  const [modifiers, [nonModifier]] = split(accelerator)
  const inputModifiers = normalizeModifiers(modifiers).map(
    normalizedModifierToInputProperty
  )

  const modifiersCheckStrict = (i: Input): boolean => {
    const excessInputProperties = inputProperties.filter(
      p => !inputModifiers.includes(p)
    )

    return modifiersCheckNonStrict(i) && excessInputProperties.every(
      mod => !i[mod]
    )
  }
  const modifiersCheckNonStrict = (i: Input): boolean =>
    inputModifiers.every(
      mod => i[mod]
    )

  const modifiersCheck: (i: Input) => boolean = strictOpt
    ? modifiersCheckStrict
    : modifiersCheckNonStrict
  
  const onKeyUp = (): void => constVoid()
  const onKeyDown = (input: Input): void => {
    return input.key.toLowerCase() === nonModifier.toLowerCase() && modifiersCheck(
      input
    ) ? f() : constVoid()
  }

  const handler = (_: Event, i: Input): void =>
    i.type === 'keyUp'
      ? onKeyUp()
      : onKeyDown(i)

  // Register shortcut on the given window
  const register = (w: BrowserWindow) => w.webContents.on(
    'before-input-event',
    handler 
  )

  // Register shortcut for new windows if required
  enableForNew
    ? app.on('browser-window-created', (_, win) => {
      register(win)
    })
    : constVoid()

  // Register shortcut for existing window(s)
  return windows.forEach(
    register
  )
}
