!macro customInit
  ${If} $INSTDIR == ""
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APP_FILENAME}"
  ${EndIf}
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR"
!macroend
