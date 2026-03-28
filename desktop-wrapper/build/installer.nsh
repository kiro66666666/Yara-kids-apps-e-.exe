!macro customInit
  StrCmp $INSTDIR "" 0 +2
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APP_FILENAME}"
!macroend

!macro customInstall
  StrLen $0 $INSTDIR
  IntCmp $0 2 rootNoSlash checkLen3 done
checkLen3:
  IntCmp $0 3 rootWithSlash done done
rootNoSlash:
  StrCpy $1 $INSTDIR 1 1
  StrCmp $1 ":" 0 done
  StrCpy $INSTDIR "$INSTDIR\YARA Kids"
  Goto done
rootWithSlash:
  StrCpy $1 $INSTDIR 1 1
  StrCpy $2 $INSTDIR 1 2
  StrCmp $1 ":" 0 done
  StrCmp $2 "\" 0 done
  StrCpy $1 $INSTDIR 2
  StrCpy $INSTDIR "$1\YARA Kids"
done:
  CreateDirectory "$INSTDIR"
!macroend
