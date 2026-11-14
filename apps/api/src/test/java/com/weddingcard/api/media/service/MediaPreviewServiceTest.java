package com.weddingcard.api.media.service;

import static org.junit.jupiter.api.Assertions.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.HexFormat;
import java.util.Random;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import com.weddingcard.api.http.Sql;
import java.util.Map;

class MediaPreviewServiceTest {
  @Test
  void readsPersistedPreviewAfterMemoryCacheIsCleared() throws Exception {
    var media = mock(MediaService.class);
    var sql = mock(Sql.class);
    byte[] preview = photo();
    when(sql.one(anyString(), eq("test.jpg"), eq(480)))
        .thenReturn(Map.of("mime", "image/jpeg", "content", preview));
    var service = new MediaPreviewService(media, sql);
    assertArrayEquals(preview, service.get("test.jpg", 480).content());
    service.clear();
    assertArrayEquals(preview, service.get("test.jpg", 480).content());
    verifyNoInteractions(media);
    verify(sql, times(2)).one(anyString(), eq("test.jpg"), eq(480));
  }
  byte[] photo() throws IOException {
    var image = new BufferedImage(1200, 800, BufferedImage.TYPE_INT_RGB);
    var random = new Random(42);
    for (int y = 0; y < image.getHeight(); y++)
      for (int x = 0; x < image.getWidth(); x++) image.setRGB(x, y, random.nextInt());
    var output = new ByteArrayOutputStream();
    ImageIO.write(image, "jpg", output);
    return output.toByteArray();
  }

  @Test
  void createsSmallerDisplayImageWithoutChangingOriginal() throws Exception {
    byte[] source = photo(), copy = source.clone();
    var preview = MediaPreviewService.create(source, "jpg", 480);
    var decoded = ImageIO.read(new ByteArrayInputStream(preview.content()));
    assertEquals(480, decoded.getWidth());
    assertEquals(320, decoded.getHeight());
    assertTrue(preview.content().length < source.length / 2);
    assertArrayEquals(copy, source);
  }

  @Test
  void respectsCameraExifOrientation() throws Exception {
    byte[] source = photo();
    byte[] exif = HexFormat.of().parseHex("45786966000049492a0008000000010012010300010000000600000000000000");
    var output = new ByteArrayOutputStream();
    output.write(source, 0, 2);
    output.write(new byte[] {(byte)0xff, (byte)0xe1, 0, (byte)(exif.length + 2)});
    output.write(exif);
    output.write(source, 2, source.length - 2);
    var preview = MediaPreviewService.create(output.toByteArray(), "jpg", 480);
    var decoded = ImageIO.read(new ByteArrayInputStream(preview.content()));
    assertEquals(320, decoded.getWidth());
    assertEquals(480, decoded.getHeight());
  }
}
