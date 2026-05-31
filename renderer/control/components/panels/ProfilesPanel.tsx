import React, { useEffect, useState } from 'react';
import { useConfigStore } from '../../store/config-store';

export function ProfilesPanel() {
  const { profiles, loadProfiles, saveProfile, loadProfile, deleteProfile } = useConfigStore();
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await saveProfile(newName.trim());
      flash(`✓ Profil "${newName.trim()}" sauvegardé`);
      setNewName('');
    } catch (e) {
      flash('Erreur lors de la sauvegarde');
    }
    setLoading(false);
  };

  const handleLoad = async (name: string) => {
    setLoading(true);
    try {
      await loadProfile(name);
      flash(`✓ Profil "${name}" chargé`);
    } catch (e) {
      flash(`Profil "${name}" introuvable`);
    }
    setLoading(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Supprimer le profil "${name}" ?`)) return;
    await deleteProfile(name);
    flash(`✗ Profil "${name}" supprimé`);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Profils</h2>
        <p className="panel-desc">Sauvegardez et rechargez la configuration complète par événement.</p>
      </div>

      {/* Save new profile */}
      <div className="field-group">
        <label className="field-label">Créer un nouveau profil</label>
        <div className="save-profile-row">
          <input
            className="field-input"
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Ex: Paris Major — Groupe C"
            disabled={loading}
          />
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!newName.trim() || loading}
          >
            Sauvegarder
          </button>
        </div>
        <p className="field-hint">Sauvegarde toute la configuration actuelle (équipes, match, apparence).</p>
      </div>

      {/* Status flash */}
      {status && <div className="profile-status">{status}</div>}

      <div className="divider" />

      {/* Profile list */}
      <div className="field-group">
        <label className="field-label">Profils enregistrés</label>
        {profiles.length === 0 ? (
          <div className="profile-empty">
            Aucun profil sauvegardé.<br />
            Créez-en un ci-dessus pour commencer.
          </div>
        ) : (
          <div className="profile-list">
            {profiles.map(name => (
              <div className="profile-item" key={name}>
                <span className="profile-name">{name}</span>
                <div className="profile-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleLoad(name)}
                    disabled={loading}
                  >
                    Charger
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(name)}
                    disabled={loading}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
