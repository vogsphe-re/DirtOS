; DirtOS NSIS installer hooks
; Ensures the default user data root exists immediately after install.

!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$DOCUMENTS\DirtOS"
  CreateDirectory "$DOCUMENTS\DirtOS\Examples"
  CreateDirectory "$DOCUMENTS\DirtOS\backups"
!macroend
