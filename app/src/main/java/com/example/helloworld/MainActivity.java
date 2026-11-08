package com.example.helloworld;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView text = new TextView(this);
        text.setText(R.string.greeting);
        text.setTextSize(32);
        text.setGravity(Gravity.CENTER);
        text.setFitsSystemWindows(true);   // stay clear of status/nav bars (edge-to-edge)

        setContentView(text);
    }
}
