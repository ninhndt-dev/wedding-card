package com.weddingcard.api.editor.repository;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.weddingcard.api.http.*;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PublishedCacheTest {
  @Test void publicationParsingIsReusedButExternalUpdatesAreVisibleImmediately() {
    var sql = mock(Sql.class);
    var json = spy(new Json(JsonMapper.builder().build()));
    var source = new AtomicReference<>("{\"site\":{\"guestName\":\"First\"}}");
    when(sql.one("SELECT published FROM editor_documents WHERE id=1"))
        .thenAnswer(invocation -> Map.of("published", source.get()));
    var repo = new EditorRepository(sql, json);
    var first = repo.published();
    assertSame(first, repo.published());
    verify(json, times(1)).parse(source.get());
    assertThrows(UnsupportedOperationException.class, () -> Json.map(first.get("site")).put("guestName", "Mutated"));
    source.set("{\"site\":{\"guestName\":\"Second\"}}");
    assertEquals("Second", Json.map(repo.published().get("site")).get("guestName"));
    var committed = repo.published();
    org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(true);
    try {
      source.set("{\"site\":{\"guestName\":\"Uncommitted\"}}");
      assertEquals("Uncommitted", Json.map(repo.published().get("site")).get("guestName"));
    } finally {
      org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(false);
      source.set("{\"site\":{\"guestName\":\"Second\"}}");
    }
    assertSame(committed, repo.published());
    repo.invalidatePublished();
    assertEquals("Second", Json.map(repo.published().get("site")).get("guestName"));
  }
}
