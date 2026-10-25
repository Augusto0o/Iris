# Auditoría de barras — 25 octubre 2026

Problemas confirmados en código:
- Reglas acumuladas mezclaban fixed, absolute, top calculado y bottom.
- El margen inferior sumaba 30px a hasta 34px de safe area.
- Se extendía la altura visible usando 100vh, aunque la prueba M3 mostró recorte.
- Los iframes reservaban espacio para una navegación que ya vive fuera de ellos.

Cambio: un único grid raíz con filas para inset superior, contenido y navegación. La navegación ocupa espacio real; ya no se superpone al contenido. El margen inferior es max(8px, despeje pendiente), no una suma. No se usa screen.height ni 100vh para ampliar el área dibujable.

Referencias primarias:
- https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
- https://www2.webkit.org/show_bug.cgi?id=300445

Limitación pendiente: el color y la geometría de la barra de estado de una PWA instalada dependen de WebKit y de los metadatos guardados al instalar. No se puede certificar el resultado físico desde un navegador de escritorio. El reporte de WebKit describe regresiones edge-to-edge; estas no se resuelven agregando píxeles fuera del viewport.

## Barra inferior demasiado alta en la PWA instalada (25 octubre 2026)

Medición en iPhone 402×874 pt: el viewport en standalone mide 812 pt. iOS pinta los 62 pt restantes debajo de la página (WebKit bug 301994) y ningún elemento del DOM puede llegar ahí. Esa franja ya despeja el indicador de inicio, pero la barra le sumaba otros 34 pt de safe area y un mínimo de 30 px: los iconos quedaban unos 96 pt por encima del borde.

Cambio: `bottomClearance()` en `src/viewport.js` resta esa franja del inset inferior. Si iOS vuelve a dar el viewport completo (874 pt), la franja es 0 y la barra recupera sus 34 pt normales sin tocar nada. El mínimo bajó de 30 px a 8 px para no dejar aire de más en Android o escritorio.

Referencia: https://bugs.webkit.org/show_bug.cgi?id=301994
