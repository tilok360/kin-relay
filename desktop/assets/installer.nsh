; Kin Relay installer pages: a welcome page with an Install button, per-user install (no administrator), then Finish
; with "Run Kin Relay" ticked.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER
Function krWelcomeShow
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x000C 0 "STR:&Install" ; WM_SETTEXT
FunctionEnd
!endif

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Install Kin Relay"
  !define MUI_WELCOMEPAGE_TEXT "Kin Relay plays your Kindroid games on this PC, free of Kindroid Apps credits, and hosts tables for friends.$\r$\n$\r$\nIt installs just for you (no administrator needed) and adds Kin Relay to your Start menu and desktop.$\r$\n$\r$\nYour API key, characters and saves stay in your own user folder and are kept if you uninstall.$\r$\n$\r$\nClick Install to continue."
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW krWelcomeShow
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Before installing over a copy that's open, the standard check closes Kin Relay. It is skipped only under Wine (used
; to test this installer on Linux), where Windows' process list tools answer wrongly.
!include "getProcessInfo.nsh"
Var pid
!macro customCheckAppRunning
  ClearErrors
  EnumRegKey $R9 HKCU "Software\Wine" 0
  ${if} ${Errors}
    !insertmacro IS_POWERSHELL_AVAILABLE
    !insertmacro _CHECK_APP_RUNNING
  ${endif}
!macroend
