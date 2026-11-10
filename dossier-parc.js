/* LE PARC DU CHEF DE PARC, CHIFFRÉ.

   Ce fichier est produit une fois par generer-acces-parc.html, sur le
   téléphone de la société : le mot de passe maître y déchiffre le dossier, en
   extrait les véhicules, les fiches conducteur et le nom de la société, et le
   rechiffre sous le code du chef de parc. Le mot de passe maître ne quitte pas
   l'appareil, et ce bloc ne contient ni le registre du personnel, ni le
   dossier de l'affaire, ni les audits.

   Tant qu'il n'a pas été généré, il vaut null : le code du chef de parc
   n'ouvre alors rien, et la porte le dit comme pour un mot de passe faux. */
window.DOSSIER_PARC = null;
