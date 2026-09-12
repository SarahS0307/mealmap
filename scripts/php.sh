#!/bin/sh
# Findet ein brauchbares PHP: erst das im Pfad, sonst das aktuellste aus MAMP.
# So bleiben die Skripte lauffähig, auch wenn MAMP neu installiert wird oder
# die PHP-Version wechselt.

if command -v php >/dev/null 2>&1; then
  exec php "$@"
fi

for candidate in /Applications/MAMP/bin/php/php*/bin/php; do
  [ -x "$candidate" ] && found="$candidate"
done

if [ -n "$found" ]; then
  exec "$found" "$@"
fi

echo "Kein PHP gefunden. Läuft MAMP, oder ist PHP im Pfad?" >&2
exit 1
