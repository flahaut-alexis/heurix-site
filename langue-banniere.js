/* Banniere qui propose l'autre langue — Heurix
 *
 * CE QU'ELLE N'EST PAS. Pas une modale, pas une redirection, pas une lecture
 * de l'adresse IP. Le visiteur decide, et il decide apres avoir lu.
 *
 *   - une modale bloque avant que le visiteur ait rien lu. Un prospect qui
 *     arrive sur une page solutions par une recherche verrait une
 *     interruption avant le contenu ;
 *   - un contenu masque par une couche a l'arrivee pese sur l'evaluation de
 *     la page, et les onze pages solutions sont l'actif SEO du site ;
 *   - l'adresse IP dit le pays, pas la langue. Le pays est subi, la langue du
 *     navigateur est choisie. C'est la seule des deux qui repond a la
 *     question posee.
 *
 * LA REGLE DE DECLENCHEMENT, une seule question : LE NAVIGATEUR DECLARE-T-IL
 * LE FRANCAIS ?
 *
 *     page FR + aucun `fr*` dans navigator.languages  -> proposer l'anglais
 *     page EN + un `fr*` present                      -> proposer le francais
 *
 * LE CAS LIMITE, NOMME PLUTOT QUE SUBI : `navigator.languages` VIDE (certains
 * modes de confidentialite stricte). Aucun `fr*` n'est trouve, donc une page
 * francaise propose l'anglais et une page anglaise ne propose rien. C'est le
 * comportement voulu et pas un accident de la boucle : un navigateur qui ne
 * declare rien tombe dans la meme tranche que celui qui declare une langue
 * tierce -- celle que le `x-default` envoie sur le francais sans le lui
 * demander. La proposition est non bloquante et se refuse en un clic ; la
 * refuser d'office serait le seul choix qu'on prendrait a sa place.
 *
 * ET PAS « le navigateur declare-t-il l'anglais », qui semble equivalent et ne
 * l'est pas. Les 126 pages appariees declarent `x-default` vers le FRANCAIS :
 * un navigateur `de`, `es`, `it`, `nl` -- non francophone -- est donc envoye
 * sur le francais PAR le hreflang lui-meme, arrivee par recherche comprise.
 * Pour cette tranche, hreflang ne retrecit pas le lot : il le produit. Une
 * regle en « declare-t-il l'anglais » la raterait entierement, c'est-a-dire
 * raterait la seule tranche que le referencement ne couvre deja pas.
 *
 * CE QUE hreflang COUVRE VRAIMENT, mesure du 6 septembre 2026. Il ne lit pas
 * `Accept-Language` : il fait permuter l'URL en SERP selon la langue que
 * Google prete a l'utilisateur. Il ne couvre donc ni le lien direct, ni
 * l'adresse tapee, ni le reseau social, ni le courriel, ni la citation par un
 * assistant -- aucune SERP, aucune permutation. Et le site distribue des URL
 * francaises : llms.txt liste 7 URL FR contre 2 EN, et chaque page FR porte
 * son og:url et son canonical en francais. Cote Bing, hreflang est un signal
 * que Microsoft qualifie lui-meme de faible, et `content-language`, celui
 * qu'il dit preferer, est absent des 154 pages du depot.
 *
 * LA CIBLE VIENT DU hreflang DE LA PAGE, jamais d'une URL reconstruite. Coller
 * « en/ » devant le chemin courant marche pour 124 des 126 pages et se trompe
 * sur confidentialite.html <-> en/privacy.html. Le href est ecrit dans le
 * balisage, derive du hreflang, et tests/banniere-langue.test.js l'y epingle.
 *
 * OU EST LA DECISION D'AFFICHAGE. Pas ici : dans un extrait inline place juste
 * apres la banniere dans chaque page, donc SYNCHRONE et anterieur au premier
 * rendu. La banniere est dans le flux, `hidden`, et sa revelation fait partie
 * de la premiere mise en page -- aucun decalage. Ce fichier-ci est differe et
 * ne s'occupe que des deux gestes : refuser, accepter.
 */
(function () {
  "use strict";

  /* LA CLE, ET POURQUOI ELLE N'EST PAS SOUMISE AU BANDEAU COOKIES.
   *
   * L'article 82 de la loi Informatique et Libertes couvre toute lecture ou
   * ecriture dans le terminal, localStorage compris -- la question se pose
   * donc vraiment. La deliberation CNIL n° 2020-091 du 17 septembre 2020 y
   * repond en nommant le cas litteralement : figurent parmi les traceurs
   * exemptes de consentement « les traceurs de personnalisation de l'interface
   * utilisateur (par exemple, pour le choix de la langue ou de la
   * presentation d'un service) ».
   *
   * LA CONDITION, qui est la contrepartie de l'exemption et pas une precaution
   * de plus : L'EXEMPTION TIENT TANT QUE LA VALEUR RESTE UN CODE DE LANGUE DE
   * DEUX CARACTERES. Pas d'identifiant, pas d'horodatage exploitable, pas de
   * reemploi pour autre chose. Le jour ou cette cle porte davantage, elle sort
   * de l'exemption et doit passer par consent.js. `ecrire()` plus bas refuse
   * donc tout ce qui n'est pas "fr" ou "en" -- la condition est verifiee la ou
   * l'ecriture se fait, pas seulement enoncee ici.
   *
   * ET SURTOUT : CONDITIONNER CETTE MEMORISATION AU CONSENTEMENT SERAIT UN
   * DEFAUT, PAS UNE PRUDENCE. Un visiteur qui refuse les traceurs doit quand
   * meme voir son refus de langue tenir. Le subordonner au bandeau le
   * casserait precisement pour les gens les plus susceptibles de refuser.
   *
   * L'exemption leve le consentement, pas la transparence : la cle est
   * mentionnee dans confidentialite.html et en/privacy.html.
   *
   * PAS D'EXPIRATION, contrairement aux 6 mois de consent.js. Un CONSENTEMENT
   * doit etre redemande ; une preference d'interface n'a pas cette regle. Et
   * un refus definitif n'enferme personne : le selecteur EN/FR reste dans
   * l'en-tete de 140 pages. C'est cette sortie-la qui autorise l'absence
   * d'expiration -- si elle disparaissait, la duree serait a revoir.
   *
   * A NOTER pour qui cherche un precedent dans le depot : il n'y en a pas.
   * `heurix_nudge_dismissed` et `heurix_guide_nudge_dismissed` sont en
   * sessionStorage. Aucune cle du site ne memorise aujourd'hui un refus
   * au-dela de l'onglet, et sessionStorage echouerait ici en silence -- le
   * visiteur reverrait la banniere en revenant demain.
   */
  var CLE = "heurix_langue";

  var banniere = document.getElementById("langue-banniere");
  if (!banniere) return;

  // La langue de la page, comme consent.js, console-i18n.js et six autres
  // modules la lisent. PAS la forme de search-engine.js, qui la deduit du
  // chemin (`/(^|\/)en\//`) : elle se tromperait sur en/privacy.html, dont le
  // partenaire francais ne porte pas le meme nom.
  var languePage = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase();
  var langueProposee = languePage === "fr" ? "en" : "fr";

  function ecrire(langue) {
    // Le garde de l'exemption CNIL, applique a l'ecriture. Voir le bloc de
    // CLE ci-dessus.
    if (langue !== "fr" && langue !== "en") return;
    try { window.localStorage.setItem(CLE, langue); } catch (e) {}
  }

  var refus = banniere.querySelector(".langue-banniere-non");
  if (refus) {
    refus.addEventListener("click", function () {
      // Le refus retient la langue COURANTE : le visiteur reste ou il est.
      ecrire(languePage);
      banniere.hidden = true;
    });
  }

  var lien = banniere.querySelector(".langue-banniere-lien");
  if (lien) {
    lien.addEventListener("click", function () {
      // L'acceptation retient la langue PROPOSEE, sans quoi la page d'arrivee
      // proposerait aussitot le retour : un francophone passe a l'anglais y
      // verrait une banniere francaise. Meme cle, meme mecanisme, les deux
      // gestes se repondent. La navigation suit son cours -- rien n'est
      // annule ici.
      ecrire(langueProposee);
    });
  }
})();
