import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Empty, ErrorAlert, PageHeader, useApi } from "../ui";

type DestinoAdmin = {
  id: number;
  idOrigen: string;
  nombre: string;
  tipo: "sala" | "edificio";
  activo: boolean;
  bloquesConDistancia: number;
};

/** Edificios y salas que la app ofrece como destino. Desactivar uno lo saca del buscador y de nuevas visitas. */
export function DestinosPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"edificio" | "sala">("edificio");
  const [texto, setTexto] = useState("");
  const q = useDeferredValue(texto.trim());
  const destinos = useQuery({
    queryKey: ["admin", "destinos", tipo, q],
    queryFn: () => api<{ destinos: DestinoAdmin[] }>(`/admin/destinos?tipo=${tipo}&q=${encodeURIComponent(q)}`),
  });
  const cambiar = useMutation({
    mutationFn: (d: DestinoAdmin) => api(`/admin/destinos/${d.id}`, { method: "PATCH", body: { activo: !d.activo } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "destinos"] }),
  });
  const lista = destinos.data?.destinos ?? [];

  return (
    <>
      <PageHeader eyebrow="Inventario" title="Edificios y salas" description="Destinos que la app ofrece al preparar una visita, con la cantidad de bloques con distancia conocida." />
      <section className="card table-card" aria-labelledby="titulo-destinos">
        <div className="table-toolbar">
          <h2 id="titulo-destinos">{tipo === "edificio" ? "Edificios" : "Salas"}</h2>
          <div className="row-actions">
            <select aria-label="Tipo de destino" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="edificio">Edificios</option>
              <option value="sala">Salas</option>
            </select>
            <label className="input">
              <Search className="icon" aria-hidden="true" />
              <input type="search" placeholder="Buscar por nombre o código" aria-label="Buscar destino" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
          </div>
        </div>
        <ErrorAlert error={destinos.error ?? cambiar.error} onRetry={() => destinos.refetch()} />
        {destinos.isLoading && <p className="empty">Cargando…</p>}
        {destinos.data && lista.length === 0 && <Empty icon={Building2}>No hay destinos que coincidan.</Empty>}
        {lista.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Código</th>
                  <th scope="col">Bloques con distancia</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: "normal" }}>{d.nombre}</td>
                    <td className="muted">{d.idOrigen}</td>
                    <td>
                      {d.bloquesConDistancia > 0 ? d.bloquesConDistancia : <span className="badge warning">Sin distancias</span>}
                    </td>
                    <td>
                      <span className={`badge ${d.activo ? "success" : "danger"}`}>{d.activo ? "Disponible" : "Oculto"}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="secondary small" disabled={cambiar.isPending} onClick={() => cambiar.mutate(d)}>
                          {d.activo ? "Ocultar" : "Habilitar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
