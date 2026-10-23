/**
 * HEURE LOCALE, PAS UTC -- et ce n'est pas une inattention (23 octobre
 * 2026). scripts/sitemap-lastmod.py pose la date avec
 * `datetime.date.today()`, en heure locale. Entre minuit local et l'heure
 * ou l'UTC rattrape le jour (02:00 locale en ete, 01:00 en hiver), un
 * `toISOString()` lit encore la veille : mesure du 22 octobre a 00:04,
 * le script a ecrit 2026-10-22 et ce garde repondait "est dans
 * l'avenir" sur deux URL, alors que la date etait exacte.
 *
 * Passer le GENERATEUR en UTC deplacerait la panne sur l'assertion
 * suivante ("chaque <lastmod> est la date d'auteur ... %as") : %as est
 * elle-meme en heure locale, et n'est pas a nous de changer. La seule
 * date qui s'accorde avec les deux est l'heure locale.
 */
export function aujourdhuiLocal() {
  const maintenant = new Date();
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
}
