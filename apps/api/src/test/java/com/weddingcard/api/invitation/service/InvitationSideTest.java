package com.weddingcard.api.invitation.service;

import static org.junit.jupiter.api.Assertions.*;
import com.weddingcard.api.http.ApiError;
import org.junit.jupiter.api.Test;

class InvitationSideTest {
  @Test void normalizesCsvHouseholds() {
    for (var label : new String[] {"Nhà trai", "nha trai", "GROOM", "chú rể"})
      assertEquals("Nhà trai", InvitationService.normalizeSide(label));
    for (var label : new String[] {"Nhà gái", "nha gai", "BRIDE", "cô dâu"})
      assertEquals("Nhà gái", InvitationService.normalizeSide(label));
    assertThrows(ApiError.class, () -> InvitationService.normalizeSide("khác"));
  }
}
